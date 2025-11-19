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
        query = supabase.table("community_posts").select(
            "id, user_id, title, content, post_type, barangay, status, "
            "created_at, updated_at, is_pinned, allow_comments, deleted_at"
        ).is_("deleted_at", "null")

        if barangay_filter and barangay_filter != "All":
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
            
            for post in posts:
                user_data = users_lookup.get(post["user_id"])
                post["author"] = user_data or {
                    "id": post["user_id"],
                    "firstname": "Unknown",
                    "lastname": "User",
                    "role": "Resident"
                }
                post["comment_count"] = comment_counts.get(post["id"], 0)
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
    """Get all community posts with filtering options"""
    try:
        user_id = request.user_id
        barangay_filter = request.args.get("barangay")
        post_type_filter = request.args.get("post_type")
        limit = int(request.args.get("limit", 20))
        
        print(f"📝 Fetching community posts - barangay: {barangay_filter}, type: {post_type_filter}")
        
        # Build query - OPTIMIZATION: Select only needed fields
        query = supabase.table("community_posts").select(
            "id, user_id, title, content, post_type, barangay, status, "
            "created_at, updated_at, is_pinned, allow_comments, deleted_at"
        ).is_("deleted_at", "null")

        if barangay_filter and barangay_filter != "All":
            query = query.eq("barangay", barangay_filter)

        if post_type_filter and post_type_filter in POST_TYPES:
            query = query.eq("post_type", post_type_filter)

        # Order by pinned first, then by created_at
        response = query.order("is_pinned", desc=True).order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []

        # Filter out pending posts that do not belong to the requesting user.
        # Keep posts that are approved OR authored by the requester.
        posts = [p for p in posts if (p.get("status") == "approved") or (p.get("user_id") == user_id)]
        
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
            
            for post in posts:
                user_data = users_lookup.get(post["user_id"])
                post["author"] = user_data or {
                    "id": post["user_id"],
                    "firstname": "Unknown",
                    "lastname": "User",
                    "role": "Resident"
                }
                post["comment_count"] = comment_counts.get(post["id"], 0)
                post["can_edit"] = post["user_id"] == user_id
                post["can_delete"] = post["user_id"] == user_id
                enriched_posts.append(post)
        
        print(f"✅ Loaded {len(enriched_posts)} community posts")
        return jsonify({"status": "success", "posts": enriched_posts, "total": len(enriched_posts)}), 200
        
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
    """Soft delete a community post"""
    try:
        user_id = request.user_id
        
        # Fetch post to verify ownership
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        if post["user_id"] != user_id:
            return jsonify({"status": "error", "message": "You can only delete your own posts"}), 403
        
        # Soft delete
        supabase.table("community_posts").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", post_id).execute()
        
        print(f"✅ Community post {post_id} deleted")
        return jsonify({"status": "success", "message": "Post deleted"}), 200
        
    except Exception as e:
        print(f"❌ Error deleting community post: {e}")
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
    """Return approved posts for a barangay.

    - If the requester is a Barangay Official: returns posts for the official's address_barangay only (status = 'approved').
    - If the requester is an Admin: can pass ?barangay=Name to fetch approved posts for that barangay, or omit to fetch all approved posts.
    - Regular residents: behaves like normal community posts endpoint but only returns approved posts for the requested/selected barangay.
    """
    try:
        user_id = request.user_id
        requested_barangay = request.args.get("barangay")
        limit = int(request.args.get("limit", 50))
        
        print(f"📝 Fetching barangay posts for user: {user_id}")

        # Fetch requester role and barangay
        user_resp = supabase.table("users").select("role, address_barangay").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        role = user_data.get("role") if user_data else None
        user_barangay = user_data.get("address_barangay") if user_data else None
        
        print(f"👤 User role: {role}, barangay: {user_barangay}")

        # If requester is Barangay Official, force barangay to their address
        if role == "Barangay Official":
            if not user_barangay:
                return jsonify({"status": "error", "message": "Barangay not set for official"}), 400
            barangay_filter = user_barangay
        else:
            # Admin may pass any barangay; residents may pass a barangay to view approved posts
            barangay_filter = requested_barangay

        # Build query: only approved posts
        query = supabase.table("community_posts").select("*").eq("status", "approved").is_("deleted_at", "null")
        if barangay_filter and barangay_filter != "All":
            query = query.eq("barangay", barangay_filter)

        response = query.order("is_pinned", desc=True).order("created_at", desc=True).limit(limit).execute()
        posts = getattr(response, "data", []) or []
        
        print(f"📊 Found {len(posts)} approved posts")

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
            
            for post in posts:
                try:
                    post_user = users_lookup.get(post["user_id"])
                    post["author"] = post_user or {"id": post["user_id"], "firstname": "Unknown", "lastname": "User", "role": "Resident"}
                    post["comment_count"] = comment_counts.get(post["id"], 0)
                    post["can_edit"] = post["user_id"] == user_id
                    post["can_delete"] = post["user_id"] == user_id
                    enriched_posts.append(post)
                except Exception as e:
                    print(f"⚠️ Error enriching post {post.get('id')}: {e}")
                    # Still add the post with basic info
                    post["author"] = {"id": post["user_id"], "firstname": "Unknown", "lastname": "User", "role": "Resident"}
                    post["comment_count"] = 0
                    post["can_edit"] = post["user_id"] == user_id
                    post["can_delete"] = post["user_id"] == user_id
                    enriched_posts.append(post)
        
        print(f"✅ Returning {len(enriched_posts)} enriched posts")
        return jsonify({"status": "success", "posts": enriched_posts, "total": len(enriched_posts)}), 200

    except Exception as e:
        print(f"❌ Error fetching barangay posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# ============ ADMIN MODERATION ============

@community_feed_bp.route("/community/posts/<post_id>/approve", methods=["PUT"])
@token_required
def approve_post(post_id):
    """Admin-only: Approve a pending post and automatically enable comments"""
    try:
        user_id = request.user_id

        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Update post status to approved and automatically enable comments
        update_data = {
            "status": "approved",
            "allow_comments": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        response = supabase.table("community_posts").update(update_data).eq("id", post_id).execute()
        updated_post = getattr(response, "data", [None])[0]

        print(f"✅ Post {post_id} approved by admin {user_id} - Comments automatically enabled")
        return jsonify({"status": "success", "post": updated_post, "message": "Post approved and comments enabled"}), 200

    except Exception as e:
        print(f"❌ Error approving post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/reject", methods=["PUT"])
@token_required
def reject_post(post_id):
    """Admin-only: Reject a pending post (soft delete)"""
    try:
        user_id = request.user_id

        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

        # Soft delete the post (mark as rejected by setting deleted_at)
        supabase.table("community_posts").update({"deleted_at": datetime.now(timezone.utc).isoformat()}).eq("id", post_id).execute()

        print(f"✅ Post {post_id} rejected by admin {user_id}")
        
        # Create notification for the post author about rejection
        post_author_id = post.get("user_id")
        post_title = post.get("title")
        if post_author_id:
            from utils.notifications import create_notification
            create_notification(
                post_author_id,
                "Post Rejected",
                f'Your post "{post_title}" did not meet our community guidelines and was not approved for public visibility.',
                "Post Alert"
            )
        
        return jsonify({"status": "success", "message": "Post rejected"}), 200

    except Exception as e:
        print(f"❌ Error rejecting post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@community_feed_bp.route("/community/posts/<post_id>/toggle-comments", methods=["PUT"])
@token_required
def toggle_post_comments(post_id):
    """Admin-only: Toggle allow_comments on a post"""
    try:
        user_id = request.user_id
        data = request.get_json()

        # Verify role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user_data = getattr(user_resp, "data", [None])[0]
        if not user_data or user_data.get("role") != "Admin":
            return jsonify({"status": "error", "message": "Forbidden"}), 403

        # Fetch post
        post_resp = supabase.table("community_posts").select("*").eq("id", post_id).is_("deleted_at", "null").execute()
        post = getattr(post_resp, "data", [None])[0]

        if not post:
            return jsonify({"status": "error", "message": "Post not found"}), 404

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

