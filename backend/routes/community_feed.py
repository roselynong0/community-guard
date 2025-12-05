"""
Community Feed Blueprint
Handles community posts and comments
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from middleware.auth import token_required
from utils import supabase, supabase_retry

community_feed_bp = Blueprint("community_feed", __name__)

# Post Types for filtering
POST_TYPES = ["incident", "safety", "suggestion", "recommendation", "general"]

# ============ GET POSTS ============

@community_feed_bp.route("/community/posts/all", methods=["GET"])
@token_required
def get_all_community_posts_admin():
    """Admin-only: Get all community posts (including pending) for moderation"""
    try:
        user_id = request.user_id
        barangay_filter = request.args.get("barangay")
        post_type_filter = request.args.get("post_type")
        limit = int(request.args.get("limit", 50))
        
        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        print(f"📝 Admin fetching all community posts - barangay: {barangay_filter}, type: {post_type_filter}")
        
        # Build query - OPTIMIZATION: Select only needed fields
        # Status values: approved, pending, rejected (no is_accepted/is_rejected booleans)
        query = supabase.table("community_posts").select(
            "id, user_id, title, content, post_type, barangay, status, "
            "created_at, updated_at, is_pinned, allow_comments, deleted_at, react_counts"
        ).is_("deleted_at", "null")

        # Only filter by barangay if a specific one is provided (not "All" or "All Barangays")
        if barangay_filter and barangay_filter not in ["All", "All Barangays"]:
            query = query.eq("barangay", barangay_filter)

        if post_type_filter and post_type_filter in POST_TYPES:
            query = query.eq("post_type", post_type_filter)

        # Order by pending first, then pinned, then by created_at
        response = query.order("status", desc=False).order("is_pinned", desc=True).order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []
        
        # OPTIMIZATION: Batch fetch user info instead of per-post queries
        enriched_posts = []
        if posts:
            # Get all unique user IDs
            user_ids = list(set(post["user_id"] for post in posts))
            
            # Single batch query for all user data
            users_resp = supabase.table("users").select(
                "id, firstname, lastname, avatar_url, role"
            ).in_("id", user_ids).execute()
            
            users_data = getattr(users_resp, "data", []) or []
            users_lookup = {user["id"]: user for user in users_data}
            
            # Batch fetch comment counts for all posts
            comments_resp = supabase.table("community_comments").select(
                "post_id", count="exact"
            ).in_("post_id", [p["id"] for p in posts]).is_("deleted_at", "null").execute()
            
            comment_counts = {}
            if getattr(comments_resp, "data", None):
                for post_id in [p["id"] for p in posts]:
                    comment_counts[post_id] = sum(
                        1 for c in getattr(comments_resp, "data", []) if c.get("post_id") == post_id
                    )
            
            # Use react_counts from DB as primary source for stable trending
            for post in posts:
                user_data = users_lookup.get(post["user_id"])
                post["author"] = user_data or {
                    "id": post["user_id"],
                    "firstname": "Unknown",
                    "lastname": "User",
                    "role": "Resident"
                }
                post["comment_count"] = comment_counts.get(post["id"], 0)
                # Use react_counts from DB (synced on reaction toggle)
                post["reaction_count"] = post.get("react_counts") or 0
                post["can_edit"] = post["user_id"] == user_id
                post["can_delete"] = post["user_id"] == user_id
                enriched_posts.append(post)
        
        print(f"✅ Loaded {len(enriched_posts)} community posts for admin")
        return jsonify({"status": "success", "posts": enriched_posts, "total": len(enriched_posts)}), 200
        
    except Exception as e:
        print(f"❌ Error fetching admin community posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e), "posts": []}), 500


@community_feed_bp.route("/community/posts", methods=["GET"])
@token_required
def get_community_posts():
    """Get all community posts with filtering options and newsfeed algorithm"""
    try:
        user_id = request.user_id
        barangay_filter = request.args.get("barangay")
        post_type_filter = request.args.get("post_type")
        sort_algorithm = request.args.get("sort", "trending")  # trending, latest, top
        limit = int(request.args.get("limit", 20))
        
        print(f"📝 Fetching community posts - barangay: {barangay_filter}, type: {post_type_filter}, sort: {sort_algorithm}")
        
        # Build query - OPTIMIZATION: Select only needed fields
        # Status values: approved, pending, rejected (no is_accepted/is_rejected booleans)
        def fetch_posts():
            query = supabase.table("community_posts").select(
                "id, user_id, title, content, post_type, barangay, status, "
                "created_at, updated_at, is_pinned, allow_comments, deleted_at, react_counts"
            ).is_("deleted_at", "null")

            # Only filter by barangay if a specific one is provided (not "All" or "All Barangays")
            if barangay_filter and barangay_filter not in ["All", "All Barangays"]:
                query = query.eq("barangay", barangay_filter)

            if post_type_filter and post_type_filter in POST_TYPES:
                query = query.eq("post_type", post_type_filter)

            # Order by pinned first, then by created_at (we'll re-sort with algorithm later)
            return query.order("is_pinned", desc=True).order("created_at", desc=True).limit(limit * 2).execute()
        
        # Use retry wrapper for network resilience
        response = supabase_retry(fetch_posts)
        posts = getattr(response, "data", []) or []

        # Filter out posts that shouldn't be visible to the user.
        # Keep posts that are:
        # - status='approved' (visible to all)
        # - status='pending' but authored by the requester
        # - status='rejected' but authored by the requester (for acknowledgment)
        posts = [
            p for p in posts 
            if p.get("status") == "approved" 
            or p.get("user_id") == user_id
        ]
        
        # OPTIMIZATION: Batch fetch user info instead of per-post queries
        enriched_posts = []
        if posts:
            # Get all unique user IDs
            user_ids = list(set(post["user_id"] for post in posts))
            post_ids = [p["id"] for p in posts]
            
            # Single batch query for all user data with retry
            def fetch_users():
                return supabase.table("users").select(
                    "id, firstname, lastname, avatar_url, role"
                ).in_("id", user_ids).execute()
            
            users_resp = supabase_retry(fetch_users)
            users_data = getattr(users_resp, "data", []) or []
            users_lookup = {user["id"]: user for user in users_data}
            
            # ⭐ OPTIMIZED: Batch fetch comment counts using grouped query
            comment_counts = {}
            try:
                # Fetch all comments for these posts in one query with retry
                def fetch_comments():
                    return supabase.table("community_comments").select(
                        "post_id"
                    ).in_("post_id", post_ids).is_("deleted_at", "null").execute()
                
                comments_resp = supabase_retry(fetch_comments)
                comments_data = getattr(comments_resp, "data", []) or []
                
                # Count comments per post_id efficiently
                for c in comments_data:
                    pid = c.get("post_id")
                    if pid:
                        comment_counts[pid] = comment_counts.get(pid, 0) + 1
                
                print(f"📊 Comment counts for {len(post_ids)} posts: {len(comment_counts)} with comments")
            except Exception as e:
                print(f"⚠️ Error fetching comment counts: {e}")
            
            # ⭐ OPTIMIZED: Batch fetch user reactions (only for user_liked status)
            # Use react_counts from DB as primary source for reaction count (more stable for trending)
            user_reactions = {}
            try:
                # Fetch user's reactions only to determine user_liked status with retry
                def fetch_user_reactions():
                    return supabase.table("community_post_reactions").select(
                        "post_id"
                    ).in_("post_id", post_ids).eq("user_id", user_id).execute()
                
                reactions_resp = supabase_retry(fetch_user_reactions)
                reactions_data = getattr(reactions_resp, "data", []) or []
                
                # Track which posts user has liked
                for r in reactions_data:
                    pid = r.get("post_id")
                    if pid:
                        user_reactions[pid] = True
                
                print(f"❤️ User has liked {len(user_reactions)} posts")
            except Exception as e:
                print(f"⚠️ Error fetching user reactions: {e}")
            
            # Build enriched posts with all counts
            # Use react_counts from DB for stable trending (updated on toggle)
            for post in posts:
                user_data = users_lookup.get(post["user_id"])
                post["author"] = user_data or {
                    "id": post["user_id"],
                    "firstname": "Unknown",
                    "lastname": "User",
                    "role": "Resident"
                }
                post["comment_count"] = comment_counts.get(post["id"], 0)
                # Use react_counts from DB as primary source (synced on reaction toggle)
                post["reaction_count"] = post.get("react_counts") or 0
                post["user_liked"] = user_reactions.get(post["id"], False)
                post["can_edit"] = post["user_id"] == user_id
                post["can_delete"] = post["user_id"] == user_id
                enriched_posts.append(post)
        
        # Apply newsfeed algorithm based on sort type
        from datetime import datetime, timezone
        
        def calculate_trending_score(post):
            """
            Trending Score Algorithm:
            - Combines engagement (reactions + comments) with time decay
            - Formula: (reactions * 10 + comments * 5 + type_weight) / (hours_old + 2)^1.2
            - Higher weight on reactions to surface popular content
            """
            reactions = post.get("reaction_count", 0)
            comments = post.get("comment_count", 0)
            post_type = post.get("post_type", "general")
            
            # Post type weights - incident/safety posts get priority
            type_weights = {
                "incident": 3,
                "safety": 2.5,
                "suggestion": 2,
                "recommendation": 1.5,
                "general": 1
            }
            type_weight = type_weights.get(post_type, 1)
            
            # Calculate age in hours
            created_at = post.get("created_at", "")
            try:
                if created_at:
                    if created_at.endswith("Z"):
                        created_at = created_at[:-1] + "+00:00"
                    post_time = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    hours_old = max(0.1, (now - post_time).total_seconds() / 3600)
                else:
                    hours_old = 24
            except:
                hours_old = 24
            
            # Engagement score - reactions weighted heavily to surface popular posts
            engagement = (reactions * 10) + (comments * 5) + type_weight
            
            # Time decay factor - gentler decay (1.2 instead of 1.5)
            time_factor = (hours_old + 2) ** 1.2
            
            # Calculate trending score
            trending_score = engagement / time_factor
            
            # Boost pinned posts significantly
            if post.get("is_pinned"):
                trending_score += 10000
            
            return trending_score
        
        def calculate_top_score(post):
            """
            Top Score Algorithm:
            - Pure engagement ranking, no time decay
            - Good for "best of all time" sorting
            """
            reactions = post.get("reaction_count", 0)
            comments = post.get("comment_count", 0)
            
            # Pinned posts always on top
            base = 10000 if post.get("is_pinned") else 0
            return base + (reactions * 10) + (comments * 5)
        
        # Sort based on algorithm type
        if sort_algorithm == "trending":
            enriched_posts.sort(key=calculate_trending_score, reverse=True)
            print(f"🔥 Applied TRENDING algorithm")
        elif sort_algorithm == "top":
            enriched_posts.sort(key=calculate_top_score, reverse=True)
            print(f"⭐ Applied TOP algorithm")
        elif sort_algorithm == "latest":
            # Already sorted by created_at desc, just ensure pinned stays on top
            enriched_posts.sort(key=lambda p: (p.get("is_pinned", False), p.get("created_at", "")), reverse=True)
            print(f"🕐 Applied LATEST algorithm")
        
        # Limit results after sorting
        enriched_posts = enriched_posts[:limit]
        
        print(f"✅ Loaded {len(enriched_posts)} community posts with {sort_algorithm} sorting")
        return jsonify({"status": "success", "posts": enriched_posts, "total": len(enriched_posts), "sort": sort_algorithm}), 200
        
    except Exception as e:
        print(f"❌ Error fetching community posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e), "posts": []}), 500


@community_feed_bp.route("/community/posts/<post_id>", methods=["GET"])
@token_required
def get_post_with_comments(post_id):
    """Get a specific post with all its comments"""
    try:
        user_id = request.user_id
        
        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Check if comments are allowed
        if not post["allow_comments"]:
            # Only admin and barangay officials can see that comments are disabled
            user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
            user_data = getattr(user_resp, "data", [None])[0]
            
            if user_data and user_data.get("role") not in ["Admin", "Barangay Official"]:
                post["comments"] = []
                post["allow_comments"] = True  # Hide the fact that comments are disabled from regular users
                return jsonify({"status": "success", "post": post}), 200
        
        # Fetch comments
        comments_resp = supabase.table("community_comments").select("*").eq("post_id", post_id).is_("deleted_at", "null").order("created_at", desc=True).execute()
        comments = getattr(comments_resp, "data", []) or []
        
        # Enrich comments with author info
        enriched_comments = []
        for comment in comments:
            comment_user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, role").eq("id", comment["user_id"]).execute()
            comment_user = getattr(comment_user_resp, "data", [None])[0]
            
            comment["author"] = comment_user or {"id": comment["user_id"], "firstname": "Unknown", "lastname": "User"}
            comment["can_edit"] = comment["user_id"] == user_id
            comment["can_delete"] = comment["user_id"] == user_id
            
            enriched_comments.append(comment)
        
        # Fetch post author
        post_user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, role").eq("id", post["user_id"]).execute()
        post_user = getattr(post_user_resp, "data", [None])[0]
        post["author"] = post_user or {"id": post["user_id"], "firstname": "Unknown", "lastname": "User"}
        
        post["comments"] = enriched_comments
        post["can_edit"] = post["user_id"] == user_id
        post["can_delete"] = post["user_id"] == user_id
        
        return jsonify({"status": "success", "post": post}), 200
        
    except Exception as e:
        print(f"❌ Error fetching post with comments: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ CREATE POST ============

@community_feed_bp.route("/community/posts", methods=["POST"])
@token_required
def create_community_post():
    """Create a new community post"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Verify user exists in the users table
        user_check = supabase.table("users").select("id").eq("id", user_id).execute()
        if not getattr(user_check, "data", []):
            print(f"❌ User {user_id} not found in users table")
            return jsonify({"status": "error", "message": "User not found. Please log in again."}), 403
        
        # Validation
        required_fields = ["title", "content", "post_type", "barangay"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing_fields)}"}), 400
        
        if data.get("post_type") not in POST_TYPES:
            return jsonify({"status": "error", "message": f"Invalid post_type. Must be one of: {', '.join(POST_TYPES)}"}), 400
        
        if data.get("barangay") == "All":
            return jsonify({"status": "error", "message": "Please select a specific barangay"}), 400
        
        # Get user role to determine post status
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else "Resident"
        
        # Barangay Officials and Admins get auto-approved posts
        status = "approved" if user_role in ["Barangay Official", "Admin"] else "pending"
        
        # Create post
        new_post = {
            "user_id": user_id,
            "title": data.get("title").strip(),
            "content": data.get("content").strip(),
            "post_type": data.get("post_type"),
            "barangay": data.get("barangay"),
            "status": status,
            "allow_comments": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("community_posts").insert(new_post).execute()
        post = getattr(response, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Failed to create post"}), 500
        
        # Fetch user info
        user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        post["author"] = user_data or {"id": user_id, "firstname": "Unknown", "lastname": "User"}
        post["comment_count"] = 0
        post["can_edit"] = True
        post["can_delete"] = True
        
        # Create notification for admins about new pending post (only for residents)
        if status == "pending":
            try:
                user_name = f"{user_data.get('firstname', 'Unknown')} {user_data.get('lastname', 'User')}" if user_data else "Unknown User"
                notification_message = f"New community post submitted by {user_name}: \"{data.get('title')[:50]}...\""
                
                # Get all admins
                admins_resp = supabase.table("users").select("id").eq("role", "Admin").execute()
                admins = getattr(admins_resp, "data", []) or []
                
                # Create notification for each admin
                for admin in admins:
                    supabase.table("notifications").insert({
                        "user_id": admin.get("id"),
                        "type": "post_submitted",
                        "title": "New Community Post",
                        "message": notification_message,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "is_read": False
                    }).execute()
                
                print(f"✅ Admin notifications created for pending post {post.get('id')}")
            except Exception as notif_err:
                print(f"⚠️ Failed to create admin notification: {notif_err}")
        else:
            print(f"✅ Post auto-approved for {user_role} - no admin notification needed")
        
        print(f"✅ Community post created by user {user_id}")
        return jsonify({"status": "success", "post": post}), 201
        
    except Exception as e:
        print(f"❌ Error creating community post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ UPDATE POST ============

@community_feed_bp.route("/community/posts/<post_id>", methods=["PUT"])
@token_required
def update_community_post(post_id):
    """Update a community post (title, content, or allow_comments)"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Fetch post to verify ownership
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        if post["user_id"] != user_id:
            return jsonify({"status": "error", "message": "You can only edit your own posts"}), 403
        
        # Check if user is Admin or Barangay Official to toggle allow_comments
        if "allow_comments" in data:
            user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
            user_data = getattr(user_resp, "data", [None])[0]
            
            # Only allow editing allow_comments if user is post owner, admin, or barangay official
            can_toggle = user_data and user_data.get("role") in ["Admin", "Barangay Official"]
            if not can_toggle and post["user_id"] != user_id:
                return jsonify({"status": "error", "message": "Only post owner or officials can toggle comments"}), 403
        
        # Update post
        update_data = {}
        if "title" in data:
            update_data["title"] = data["title"].strip()
        if "content" in data:
            update_data["content"] = data["content"].strip()
        if "allow_comments" in data:
            update_data["allow_comments"] = data["allow_comments"]
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        response = supabase.table("community_posts").update(update_data).eq("id", post_id).execute()
        updated_post = getattr(response, "data", [None])[0]
        
        print(f"✅ Community post {post_id} updated")
        return jsonify({"status": "success", "post": updated_post}), 200
        
    except Exception as e:
        print(f"❌ Error updating community post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ DELETE POST ============

@community_feed_bp.route("/community/posts/<post_id>", methods=["DELETE"])
@token_required
def delete_community_post(post_id):
    """Delete a community post - users can delete own posts, admins can delete any post with reason"""
    try:
        user_id = request.user_id
        permanent = request.args.get("permanent", "false").lower() == "true"
        data = request.get_json() or {}
        deletion_reason = data.get("reason", "")
        
        # Fetch post to verify ownership (include soft-deleted for rejected posts cleanup)
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Check ownership (only owner or admin can delete)
        user_resp = supabase.table("users").select("role, firstname, lastname").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        user_role = user_data.get("role") if user_data else "Resident"
        
        # Barangay Officials cannot delete posts - only accept/approve/reject
        if user_role == "Barangay Official":
            return jsonify({"status": "error", "message": "Barangay Officials cannot delete posts. Use approve/reject instead."}), 403
        
        if post["user_id"] != user_id and user_role != "Admin":
            return jsonify({"status": "error", "message": "You can only delete your own posts"}), 403
        
        post_author_id = post.get("user_id")
        post_title = post.get("title", "Untitled")
        is_admin_deleting_others_post = user_role == "Admin" and post_author_id != user_id
        
        # If admin is deleting someone else's post, notify the post author
        if is_admin_deleting_others_post and post_author_id:
            from utils.notifications import create_notification
            admin_name = f"{user_data.get('firstname', '')} {user_data.get('lastname', '')}".strip() or "Administrator"
            
            reason_text = f" Reason: {deletion_reason}" if deletion_reason else ""
            create_notification(
                post_author_id,
                "Post Deleted by Admin",
                f'Your post "{post_title}" has been removed by an administrator.{reason_text}',
                "Post Alert"
            )
            print(f"📧 Notified user {post_author_id} about post deletion by admin")
        
        # If post was already soft-deleted or permanent delete requested, permanently remove from database
        if permanent or post.get("deleted_at"):
            # Delete associated reactions first
            supabase.table("community_post_reactions").delete().eq("post_id", post_id).execute()
            # Delete associated comments
            supabase.table("community_comments").delete().eq("post_id", post_id).execute()
            # Permanently delete the post
            supabase.table("community_posts").delete().eq("id", post_id).execute()
            print(f"✅ Community post {post_id} permanently deleted")
            return jsonify({"status": "success", "message": "Post permanently deleted"}), 200
        else:
            # Soft delete for normal posts
            supabase.table("community_posts").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", post_id).execute()
            print(f"✅ Community post {post_id} soft deleted by {user_role}")
            return jsonify({"status": "success", "message": "Post deleted"}), 200
        
    except Exception as e:
        print(f"❌ Error deleting community post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/cleanup", methods=["POST"])
@token_required
def cleanup_deleted_posts():
    """Admin-only: Permanently remove all soft-deleted posts from database"""
    try:
        user_id = request.user_id
        
        # Verify admin role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden - Admin only"}), 403
        
        # Find all soft-deleted posts
        deleted_resp = supabase.table("community_posts").select("id").not_.is_("deleted_at", "null").execute()
        deleted_posts = getattr(deleted_resp, "data", []) or []
        
        deleted_count = 0
        for post in deleted_posts:
            post_id = post["id"]
            # Delete associated comments first
            supabase.table("community_comments").delete().eq("post_id", post_id).execute()
            # Permanently delete the post
            supabase.table("community_posts").delete().eq("id", post_id).execute()
            deleted_count += 1
        
        print(f"✅ Cleaned up {deleted_count} deleted posts")
        return jsonify({"status": "success", "message": f"Cleaned up {deleted_count} deleted posts", "count": deleted_count}), 200
        
    except Exception as e:
        print(f"❌ Error cleaning up deleted posts: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ COMMENTS ============

@community_feed_bp.route("/community/posts/<post_id>/comments", methods=["POST"])
@token_required
def add_comment(post_id):
    """Add a comment to a post"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Verify post exists and comments are allowed
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Prevent comments on pending posts; only allow on approved posts
        if post.get("status") != "approved":
            return jsonify({"status": "error", "message": "Comments are only allowed on approved posts"}), 403
        
        if not post["allow_comments"]:
            return jsonify({"status": "error", "message": "Comments are disabled for this post"}), 403
        
        # Validate comment
        if not data.get("content") or not data.get("content").strip():
            return jsonify({"status": "error", "message": "Comment cannot be empty"}), 400
        
        # Create comment
        new_comment = {
            "post_id": int(post_id),
            "user_id": user_id,
            "content": data.get("content").strip(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("community_comments").insert(new_comment).execute()
        comment = getattr(response, "data", [None])[0]
        
        # Fetch user info
        user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        comment["author"] = user_data or {"id": user_id, "firstname": "Unknown", "lastname": "User"}
        comment["can_edit"] = True
        comment["can_delete"] = True
        
        print(f"✅ Comment added to post {post_id}")
        return jsonify({"status": "success", "comment": comment}), 201
        
    except Exception as e:
        print(f"❌ Error adding comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/comments/<comment_id>", methods=["PUT"])
@token_required
def update_comment(comment_id):
    """Update a comment"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Fetch comment
        comment_resp = supabase.table("community_comments").select("*").eq("id", comment_id).is_("deleted_at", "null").execute()
        comment = getattr(comment_resp, "data", [None])[0]
        
        if not comment:
            return jsonify({"status": "error", "message": "Comment not found"}), 404
        
        if comment["user_id"] != user_id:
            return jsonify({"status": "error", "message": "You can only edit your own comments"}), 403
        
        # Update comment
        update_data = {
            "content": data.get("content").strip(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("community_comments").update(update_data).eq("id", comment_id).execute()
        updated_comment = getattr(response, "data", [None])[0]
        
        print(f"✅ Comment {comment_id} updated")
        return jsonify({"status": "success", "comment": updated_comment}), 200
        
    except Exception as e:
        print(f"❌ Error updating comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/comments/<comment_id>", methods=["DELETE"])
@token_required
def delete_comment(comment_id):
    """Soft delete a comment"""
    try:
        user_id = request.user_id
        
        # Fetch comment
        comment_resp = supabase.table("community_comments").select("*").eq("id", comment_id).is_("deleted_at", "null").execute()
        comment = getattr(comment_resp, "data", [None])[0]
        
        if not comment:
            return jsonify({"status": "error", "message": "Comment not found"}), 404
        
        if comment["user_id"] != user_id:
            return jsonify({"status": "error", "message": "You can only delete your own comments"}), 403
        
        # Soft delete
        supabase.table("community_comments").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", comment_id).execute()
        
        print(f"✅ Comment {comment_id} deleted")
        return jsonify({"status": "success", "message": "Comment deleted"}), 200
        
    except Exception as e:
        print(f"❌ Error deleting comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ REACTIONS / LIKES ============

@community_feed_bp.route("/community/posts/<post_id>/react", methods=["POST"])
@token_required
def toggle_reaction(post_id):
    """Toggle like/reaction on a post - only for accepted or approved posts"""
    try:
        user_id = request.user_id
        data = request.get_json() or {}
        reaction_type = data.get("reaction_type", "like")
        
        # Verify post exists and is approved
        post_resp = supabase.table("community_posts").select("id, status").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Only allow reactions on approved posts
        if post.get("status") != "approved":
            return jsonify({"status": "error", "message": "Reactions are only allowed on approved posts"}), 403
        
        # Check if user already reacted
        existing_resp = supabase.table("community_post_reactions").select("id").eq("post_id", post_id).eq("user_id", user_id).execute()
        existing = getattr(existing_resp, "data", [])
        
        if existing:
            # Remove reaction (toggle off)
            supabase.table("community_post_reactions").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
            print(f"✅ Reaction removed from post {post_id} by user {user_id}")
            
            # Get updated count
            count_resp = supabase.table("community_post_reactions").select("id", count="exact").eq("post_id", post_id).execute()
            reaction_count = count_resp.count if hasattr(count_resp, 'count') else 0
            
            # Update react_counts column on the post
            supabase.table("community_posts").update({"react_counts": reaction_count}).eq("id", post_id).execute()
            
            return jsonify({
                "status": "success", 
                "message": "Reaction removed", 
                "liked": False,
                "reaction_count": reaction_count
            }), 200
        else:
            # Add reaction
            new_reaction = {
                "post_id": int(post_id),
                "user_id": user_id,
                "reaction_type": reaction_type,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("community_post_reactions").insert(new_reaction).execute()
            print(f"✅ Reaction added to post {post_id} by user {user_id}")
            
            # Get updated count
            count_resp = supabase.table("community_post_reactions").select("id", count="exact").eq("post_id", post_id).execute()
            reaction_count = count_resp.count if hasattr(count_resp, 'count') else 1
            
            # Update react_counts column on the post
            supabase.table("community_posts").update({"react_counts": reaction_count}).eq("id", post_id).execute()
            
            return jsonify({
                "status": "success", 
                "message": "Reaction added", 
                "liked": True,
                "reaction_count": reaction_count
            }), 201
        
    except Exception as e:
        print(f"❌ Error toggling reaction: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/reactions", methods=["GET"])
@token_required
def get_post_reactions(post_id):
    """Get reactions for a post"""
    try:
        user_id = request.user_id
        
        # Get reaction count
        count_resp = supabase.table("community_post_reactions").select("id", count="exact").eq("post_id", post_id).execute()
        reaction_count = count_resp.count if hasattr(count_resp, 'count') else 0
        
        # Check if current user has reacted
        user_reaction_resp = supabase.table("community_post_reactions").select("id, reaction_type").eq("post_id", post_id).eq("user_id", user_id).execute()
        user_reaction = getattr(user_reaction_resp, "data", [])
        
        return jsonify({
            "status": "success",
            "reaction_count": reaction_count,
            "user_liked": len(user_reaction) > 0,
            "user_reaction_type": user_reaction[0]["reaction_type"] if user_reaction else None
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting reactions: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ MODERATION / BARANGAY-SPECIFIC VIEWS ============


@community_feed_bp.route("/community/posts/pending", methods=["GET"])
@token_required
def get_pending_posts():
    """Admin-only: Get pending posts across all barangays"""
    try:
        user_id = request.user_id

        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        limit = int(request.args.get("limit", 50))

        response = supabase.table("community_posts").select("*").eq("status", "pending").is_("deleted_at", "null").order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []

        enriched_posts = []
        for post in posts:
            user_resp = supabase.table("users").select("id, firstname, lastname, avatar_url, role").eq("id", post["user_id"]).execute()
            user_data = getattr(user_resp, "data", [None])[0]

            # comment count
            comment_resp = supabase.table("community_comments").select("id", count="exact").eq("post_id", post["id"]).is_("deleted_at", "null").execute()
            comment_count = len(getattr(comment_resp, "data", []))

            post["author"] = user_data or {"id": post["user_id"], "firstname": "Unknown", "lastname": "User", "role": "Resident"}
            post["comment_count"] = comment_count
            post["can_edit"] = post["user_id"] == user_id
            post["can_delete"] = post["user_id"] == user_id

            enriched_posts.append(post)

        return jsonify({"status": "success", "posts": enriched_posts, "total": len(enriched_posts)}), 200

    except Exception as e:
        print(f"❌ Error fetching pending posts: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/barangay", methods=["GET"])
@token_required
def get_barangay_posts():
    """Return posts for a barangay with moderation support.

    - If the requester is a Barangay Official: returns posts for the official's address_barangay (pending on top, then approved).
    - If the requester is an Admin: can pass ?barangay=Name to fetch posts for that barangay.
    - Responders: can view and interact with posts but cannot moderate.
    - Regular residents: only see approved or their own pending posts.
    """
    try:
        user_id = request.user_id
        requested_barangay = request.args.get("barangay")
        status_filter = request.args.get("status")  # 'all', 'pending', 'approved'
        limit = int(request.args.get("limit", 50))
        
        print(f"📝 Fetching barangay posts for user: {user_id}")

        # Fetch requester role from users table
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else "Resident"
        
        # Fetch barangay from info table (where address_barangay actually exists)
        info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        info_data = getattr(info_resp, "data", [None])[0]
        user_barangay = info_data.get("address_barangay") if info_data else None
        
        print(f"👤 User role: {role}, barangay: {user_barangay}")

        # Determine barangay filter based on role
        if role == "Barangay Official":
            if not user_barangay:
                return jsonify({"status": "error", "message": "Barangay not set for official. Please update your profile."}), 400
            barangay_filter = user_barangay
        elif role == "Admin":
            # Admin can view any barangay or all
            barangay_filter = requested_barangay if requested_barangay and requested_barangay != "All" else None
        else:
            # Responders and Residents use the requested barangay or their own
            barangay_filter = requested_barangay if requested_barangay and requested_barangay != "All" else user_barangay

        # Build query - Select needed fields (only status, no is_accepted/is_rejected)
        query = supabase.table("community_posts").select(
            "id, user_id, title, content, post_type, barangay, status, "
            "created_at, updated_at, is_pinned, allow_comments, deleted_at, react_counts"
        ).is_("deleted_at", "null")
        
        if barangay_filter:
            query = query.eq("barangay", barangay_filter)

        # Status filtering based on role
        if role in ["Admin", "Barangay Official"]:
            # Can see all posts including pending - pending posts shown first
            if status_filter == "pending":
                query = query.eq("status", "pending")
            elif status_filter == "approved":
                query = query.eq("status", "approved")
            # else: show all statuses, pending first
        elif role == "Responder":
            # Responders can see approved posts and their own pending posts
            # We'll filter client-side for now for simplicity
            pass
        else:
            # Residents: only approved or their own pending
            pass

        # Order: pending first (for moderators), then pinned, then by date
        response = query.order("status", desc=False).order("is_pinned", desc=True).order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []
        
        # Filter for non-moderators: only show approved or own posts
        if role not in ["Admin", "Barangay Official"]:
            posts = [
                p for p in posts 
                if (p.get("status") == "approved" or p.get("user_id") == user_id)
            ]
        
        print(f"📊 Found {len(posts)} posts")

        enriched_posts = []
        if posts:
            # Get all unique user IDs
            user_ids = list(set(post["user_id"] for post in posts))
            
            # Batch fetch user info
            users_resp = supabase.table("users").select(
                "id, firstname, lastname, avatar_url, role"
            ).in_("id", user_ids).execute()
            
            users_data = getattr(users_resp, "data", []) or []
            users_lookup = {user["id"]: user for user in users_data}
            
            # Batch fetch comments for all posts
            comments_resp = supabase.table("community_comments").select(
                "post_id"
            ).in_("post_id", [p["id"] for p in posts]).is_("deleted_at", "null").execute()
            
            comment_counts = {}
            if getattr(comments_resp, "data", None):
                for comment in getattr(comments_resp, "data", []):
                    post_id = comment.get("post_id")
                    comment_counts[post_id] = comment_counts.get(post_id, 0) + 1
            
            # Batch fetch user's reactions for user_liked status
            post_ids = [p["id"] for p in posts]
            user_reactions = {}
            
            try:
                reactions_resp = supabase.table("community_post_reactions").select(
                    "post_id"
                ).in_("post_id", post_ids).eq("user_id", user_id).execute()
                
                reactions_data = getattr(reactions_resp, "data", []) or []
                for r in reactions_data:
                    pid = r.get("post_id")
                    if pid:
                        user_reactions[pid] = True
            except Exception as e:
                print(f"⚠️ Error fetching user reactions: {e}")
            
            for post in posts:
                try:
                    post_user = users_lookup.get(post["user_id"])
                    post["author"] = post_user or {"id": post["user_id"], "firstname": "Unknown", "lastname": "User", "role": "Resident"}
                    post["comment_count"] = comment_counts.get(post["id"], 0)
                    # Use react_counts from DB (synced on reaction toggle) for stable trending
                    post["reaction_count"] = post.get("react_counts") or 0
                    post["user_liked"] = user_reactions.get(post["id"], False)
                    
                    # Permission flags based on role
                    is_own_post = post["user_id"] == user_id
                    post["can_edit"] = is_own_post
                    post["can_delete"] = is_own_post or role in ["Admin", "Barangay Official"]
                    post["can_moderate"] = role in ["Admin", "Barangay Official"]
                    post["can_toggle_comments"] = is_own_post or role in ["Admin", "Barangay Official"]
                    
                    enriched_posts.append(post)
                except Exception as e:
                    print(f"⚠️ Error enriching post {post.get('id')}: {e}")
                    post["author"] = {"id": post["user_id"], "firstname": "Unknown", "lastname": "User", "role": "Resident"}
                    post["comment_count"] = 0
                    post["reaction_count"] = post.get("react_counts") or 0
                    post["user_liked"] = False
                    post["can_edit"] = post["user_id"] == user_id
                    post["can_delete"] = post["user_id"] == user_id
                    post["can_moderate"] = role in ["Admin", "Barangay Official"]
                    post["can_toggle_comments"] = post["user_id"] == user_id
                    enriched_posts.append(post)
        
        print(f"✅ Returning {len(enriched_posts)} enriched posts")
        return jsonify({
            "status": "success", 
            "posts": enriched_posts, 
            "total": len(enriched_posts),
            "user_role": role,
            "user_barangay": user_barangay
        }), 200

    except Exception as e:
        print(f"❌ Error fetching barangay posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ ADMIN MODERATION ============

@community_feed_bp.route("/community/posts/<post_id>/accept", methods=["PUT"])
@token_required
def accept_post(post_id):
    """Admin/Barangay Official: Accept a pending post (shows normally but keeps pending status)"""
    try:
        user_id = request.user_id

        # Verify role - Allow Admin and Barangay Official
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else None
        
        if role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Forbidden - Only Admin or Barangay Official can accept posts"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Barangay Official can only accept posts from their own barangay
        if role == "Barangay Official":
            user_info_resp = supabase.table("users_info").select("address_barangay").eq("user_id", user_id).execute()
            user_info = getattr(user_info_resp, "data", [None])[0]
            user_barangay = user_info.get("address_barangay") if user_info else None
            post_barangay = post.get("barangay")
            
            if user_barangay and post_barangay and user_barangay != post_barangay:
                return jsonify({"status": "error", "message": "You can only moderate posts from your barangay"}), 403

        # Update post status to approved (simple status-only approach)
        update_data = {
            "status": "approved",
            "allow_comments": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        response = supabase.table("community_posts").update(update_data).eq("id", post_id).execute()
        updated_post = getattr(response, "data", [None])[0]

        print(f"✅ Post {post_id} approved by {role} {user_id}")
        return jsonify({"status": "success", "post": updated_post, "message": "Post approved"}), 200

    except Exception as e:
        print(f"❌ Error accepting post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/approve", methods=["PUT"])
@token_required
def approve_post(post_id):
    """Admin/Barangay Official: Approve a pending post and automatically enable comments"""
    try:
        user_id = request.user_id

        # Verify role - Allow Admin and Barangay Official
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else None
        
        if role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Forbidden - Only Admin or Barangay Official can approve posts"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Barangay Official can only approve posts from their own barangay
        if role == "Barangay Official":
            user_info_resp = supabase.table("users_info").select("address_barangay").eq("user_id", user_id).execute()
            user_info = getattr(user_info_resp, "data", [None])[0]
            user_barangay = user_info.get("address_barangay") if user_info else None
            post_barangay = post.get("barangay")
            
            if user_barangay and post_barangay and user_barangay != post_barangay:
                return jsonify({"status": "error", "message": "You can only moderate posts from your barangay"}), 403

        # Update post status to approved and automatically enable comments
        update_data = {
            "status": "approved",
            "allow_comments": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        response = supabase.table("community_posts").update(update_data).eq("id", post_id).execute()
        updated_post = getattr(response, "data", [None])[0]

        print(f"✅ Post {post_id} approved by {role} {user_id} - Comments automatically enabled")
        return jsonify({"status": "success", "post": updated_post, "message": "Post approved and comments enabled"}), 200

    except Exception as e:
        print(f"❌ Error approving post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/reject", methods=["PUT"])
@token_required
def reject_post(post_id):
    """Admin/Barangay Official: Reject a pending post (mark as rejected, notify user)"""
    try:
        user_id = request.user_id

        # Verify role - Allow Admin and Barangay Official
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else None
        
        if role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Forbidden - Only Admin or Barangay Official can reject posts"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Barangay Official can only reject posts from their own barangay
        if role == "Barangay Official":
            user_info_resp = supabase.table("users_info").select("address_barangay").eq("user_id", user_id).execute()
            user_info = getattr(user_info_resp, "data", [None])[0]
            user_barangay = user_info.get("address_barangay") if user_info else None
            post_barangay = post.get("barangay")
            
            if user_barangay and post_barangay and user_barangay != post_barangay:
                return jsonify({"status": "error", "message": "You can only moderate posts from your barangay"}), 403

        # Mark the post as rejected - use only status field
        update_data = {
            "status": "rejected",
            "deleted_at": datetime.now(timezone.utc).isoformat(),  # Auto soft-delete rejected posts
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table("community_posts").update(update_data).eq("id", post_id).execute()

        print(f"✅ Post {post_id} rejected and soft-deleted by {role} {user_id}")
        
        # Create notification for the post author about rejection
        post_author_id = post.get("user_id")
        post_title = post.get("title")
        if post_author_id:
            from utils.notifications import create_notification
            create_notification(
                post_author_id,
                "Post Rejected",
                f'Your post "{post_title}" did not meet our community guidelines and was automatically removed.',
                "Post Alert"
            )
        
        return jsonify({"status": "success", "message": "Post rejected, user notified, and post removed"}), 200

    except Exception as e:
        print(f"❌ Error rejecting post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/toggle-comments", methods=["PUT"])
@token_required
def toggle_post_comments(post_id):
    """Admin/Barangay Official/Post Owner: Toggle allow_comments on a post"""
    try:
        user_id = request.user_id
        data = request.get_json() or {}

        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else "Resident"

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Check permission: Admin, Barangay Official, or post owner
        is_own_post = post.get("user_id") == user_id
        if role not in ["Admin", "Barangay Official"] and not is_own_post:
            return jsonify({"status": "error", "message": "Forbidden - Only Admin, Barangay Official, or post owner can toggle comments"}), 403

        # Toggle allow_comments
        allow_comments = data.get("allow_comments")
        if allow_comments is None:
            allow_comments = not post.get("allow_comments", True)

        update_data = {
            "allow_comments": allow_comments,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        response = supabase.table("community_posts").update(update_data).eq("id", post_id).execute()
        updated_post = getattr(response, "data", [None])[0]

        status_text = "enabled" if allow_comments else "disabled"
        print(f"✅ Comments {status_text} for post {post_id} by admin {user_id}")
        return jsonify({"status": "success", "post": updated_post, "message": f"Comments {status_text}"}), 200

    except Exception as e:
        print(f"❌ Error toggling post comments: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ BARANGAY OFFICIAL POSTS ============

@community_feed_bp.route("/community/posts/barangay/create", methods=["POST"])
@token_required
def create_barangay_official_post():
    """Create a post as Barangay Official - immediately approved, no admin review needed"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Verify user is Barangay Official
        user_resp = supabase.table("users").select("id, role, address_barangay").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        
        if not user_data:
            return jsonify({"status": "error", "message": "User not found"}), 403
        
        if user_data.get("role") != "Barangay Official":
            return jsonify({"status": "error", "message": "Only Barangay Officials can use this endpoint"}), 403
        
        user_barangay = user_data.get("address_barangay")
        if not user_barangay:
            return jsonify({"status": "error", "message": "Barangay not set for official"}), 400
        
        # Validation
        required_fields = ["title", "content", "post_type"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing_fields)}"}), 400
        
        if data.get("post_type") not in POST_TYPES:
            return jsonify({"status": "error", "message": f"Invalid post_type. Must be one of: {', '.join(POST_TYPES)}"}), 400
        
        # Create post as APPROVED immediately (no admin review)
        new_post = {
            "user_id": user_id,
            "title": data.get("title").strip(),
            "content": data.get("content").strip(),
            "post_type": data.get("post_type"),
            "barangay": user_barangay,  # Auto-set to official's barangay
            "status": "approved",  # ✅ Immediately approved!
            "allow_comments": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("community_posts").insert(new_post).execute()
        post = getattr(response, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Failed to create post"}), 500
        
        # Fetch user info
        post["author"] = {
            "id": user_id,
            "firstname": user_data.get("firstname", "Unknown"),
            "lastname": user_data.get("lastname", "User"),
            "avatar_url": user_data.get("avatar_url"),
            "role": "Barangay Official"
        }
        post["comment_count"] = 0
        post["can_edit"] = True
        post["can_delete"] = True
        
        print(f"✅ Barangay Official post created by {user_id} in {user_barangay} (auto-approved)")
        return jsonify({"status": "success", "post": post, "message": "Post published successfully!"}), 201
        
    except Exception as e:
        print(f"❌ Error creating barangay official post: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ LGU ANNOUNCEMENTS ============

@community_feed_bp.route("/announcements", methods=["GET"])
@token_required
def get_announcements():
    """
    Get LGU/Barangay announcements (pinned posts from officials)
    Returns pinned posts from Admin and Barangay Officials
    """
    try:
        user_id = request.user_id
        barangay_filter = request.args.get("barangay")
        limit = int(request.args.get("limit", 10))
        
        # Get user's barangay if not provided (from users_info table)
        if not barangay_filter:
            user_info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
            user_info_data = getattr(user_info_resp, "data", [None])[0]
            if user_info_data:
                barangay_filter = user_info_data.get("address_barangay")
        
        print(f"📢 Fetching announcements for barangay: {barangay_filter}")
        
        # Build query for pinned posts from officials
        query = supabase.table("community_posts").select(
            "id, user_id, title, content, post_type, barangay, status, "
            "created_at, updated_at, is_pinned, react_counts"
        ).eq("is_pinned", True).eq("status", "approved").is_("deleted_at", "null")
        
        # Filter by barangay if provided
        if barangay_filter and barangay_filter != "All":
            query = query.eq("barangay", barangay_filter)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []
        
        # Enrich with author info (only officials)
        announcements = []
        for post in posts:
            # Get author info
            author_resp = supabase.table("users").select(
                "id, firstname, lastname, role, avatar_url"
            ).eq("id", post["user_id"]).execute()
            author = getattr(author_resp, "data", [None])[0]
            
            # Only include posts from Admin or Barangay Official
            if author and author.get("role") in ["Admin", "Barangay Official"]:
                post["author"] = author
                post["is_announcement"] = True
                announcements.append(post)
        
        print(f"✅ Loaded {len(announcements)} announcements")
        return jsonify({
            "status": "success", 
            "announcements": announcements, 
            "total": len(announcements)
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching announcements: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e), "announcements": []}), 500


@community_feed_bp.route("/announcements", methods=["POST"])
@token_required
def create_announcement():
    """
    Create a new LGU announcement (Admin/Barangay Official only)
    Auto-approves and pins the post
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Verify user is Admin or Barangay Official
        user_resp = supabase.table("users").select(
            "id, role, address_barangay, firstname, lastname, avatar_url"
        ).eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        
        if not user_data:
            return jsonify({"status": "error", "message": "User not found"}), 403
        
        user_role = user_data.get("role")
        if user_role not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Only Admin and Barangay Officials can create announcements"}), 403
        
        # Validation
        required_fields = ["title", "content"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing_fields)}"}), 400
        
        # Determine barangay
        barangay = data.get("barangay") or user_data.get("address_barangay")
        if user_role == "Barangay Official" and not barangay:
            return jsonify({"status": "error", "message": "Barangay not set for official"}), 400
        
        # Create announcement (auto-approved and pinned)
        new_announcement = {
            "user_id": user_id,
            "title": data.get("title").strip(),
            "content": data.get("content").strip(),
            "post_type": "general",  # Announcements are general posts
            "barangay": barangay,
            "status": "approved",
            "is_pinned": True,  # ✅ Always pinned
            "allow_comments": data.get("allow_comments", True),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = supabase.table("community_posts").insert(new_announcement).execute()
        announcement = getattr(response, "data", [None])[0]
        
        if not announcement:
            return jsonify({"status": "error", "message": "Failed to create announcement"}), 500
        
        # Add author info
        announcement["author"] = {
            "id": user_id,
            "firstname": user_data.get("firstname", "Unknown"),
            "lastname": user_data.get("lastname", "User"),
            "avatar_url": user_data.get("avatar_url"),
            "role": user_role
        }
        announcement["is_announcement"] = True
        
        print(f"✅ Announcement created by {user_role} {user_id}")
        return jsonify({
            "status": "success", 
            "announcement": announcement, 
            "message": "Announcement published successfully!"
        }), 201
        
    except Exception as e:
        print(f"❌ Error creating announcement: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

