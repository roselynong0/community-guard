"""
Community Feed Blueprint
Handles all community feed CRUD operations including posts, comments, and filtering
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import time
from middleware.auth import token_required
from utils import supabase, supabase_retry, create_notification

community_feed_bp = Blueprint("community_feed", __name__)

# ============================================
# 1. FETCH ALL COMMUNITY FEED POSTS
# ============================================
@community_feed_bp.route("/feed", methods=["GET"])
def get_community_feed():
    """Get all approved community feed posts with optional filters"""
    try:
        # Get query parameters
        barangay = request.args.get("barangay", "All")
        category = request.args.get("category", "All")
        search = request.args.get("search", "").strip()
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
        
        offset = (page - 1) * per_page
        
        # Build base query
        query = (
            supabase.table("community_feed_posts")
            .select("*")
            .eq("status", "approved")
            .is_("deleted_at", None)
        )
        
        # Apply filters
        if barangay and barangay != "All":
            query = query.eq("address_barangay", barangay)
        
        if category and category != "All":
            query = query.eq("category", category)
        
        if search:
            # Search in title and content
            query = query.or_(f"title.ilike.%{search}%,content.ilike.%{search}%")
        
        # Get total count
        count_resp = supabase.table("community_feed_posts").select(
            "id", count="exact"
        ).eq("status", "approved").is_("deleted_at", None)
        
        if barangay and barangay != "All":
            count_resp = count_resp.eq("address_barangay", barangay)
        if category and category != "All":
            count_resp = count_resp.eq("category", category)
        
        total_count = count_resp.execute().count or 0
        
        # Fetch posts
        query = query.order("is_pinned", desc=True).order(
            "created_at", desc=True
        ).range(offset, offset + per_page - 1)
        
        resp = supabase_retry(lambda: query.execute())
        posts = getattr(resp, "data", []) or []
        
        # Enrich posts with user data
        enriched_posts = []
        for post in posts:
            enriched_posts.append(await _enrich_post(post))
        
        return jsonify({
            "status": "success",
            "posts": enriched_posts,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_count,
                "pages": (total_count + per_page - 1) // per_page
            }
        }), 200
    
    except Exception as e:
        print(f"Error fetching community feed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 2. FETCH USER'S OWN POSTS (including pending)
# ============================================
@community_feed_bp.route("/feed/my-posts", methods=["GET"])
@token_required
def get_my_posts():
    """Get current user's posts (including pending)"""
    try:
        user_id = request.user_id
        
        query = (
            supabase.table("community_feed_posts")
            .select("*")
            .eq("user_id", user_id)
            .is_("deleted_at", None)
            .order("created_at", desc=True)
        )
        
        resp = supabase_retry(lambda: query.execute())
        posts = getattr(resp, "data", []) or []
        
        # Enrich with comment count and user data
        enriched_posts = []
        for post in posts:
            enriched_posts.append(await _enrich_post(post))
        
        return jsonify({
            "status": "success",
            "posts": enriched_posts
        }), 200
    
    except Exception as e:
        print(f"Error fetching user posts: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 3. FETCH POSTS FOR ADMIN/BARANGAY OFFICIAL VIEW
# ============================================
@community_feed_bp.route("/feed/admin", methods=["GET"])
@token_required
def get_admin_feed():
    """Get posts for admin/barangay official review"""
    try:
        user_id = request.user_id
        
        # Check user role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        
        if not user or user.get("role") not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        # For barangay officials, only show posts from their barangay
        # For admins, show all posts
        user_info_resp = supabase.table("info").select("address_barangay").eq("user_id", user_id).execute()
        user_barangay = getattr(user_info_resp, "data", [{}])[0].get("address_barangay")
        
        query = supabase.table("community_feed_posts").select("*").is_("deleted_at", None)
        
        if user.get("role") == "Barangay Official" and user_barangay:
            query = query.eq("address_barangay", user_barangay)
        
        resp = supabase_retry(lambda: query.order(
            "status", desc=False
        ).order(
            "is_pinned", desc=True
        ).order(
            "created_at", desc=True
        ).execute())
        
        posts = getattr(resp, "data", []) or []
        
        # Enrich posts
        enriched_posts = []
        for post in posts:
            enriched_posts.append(await _enrich_post(post))
        
        return jsonify({
            "status": "success",
            "posts": enriched_posts,
            "user_role": user.get("role")
        }), 200
    
    except Exception as e:
        print(f"Error fetching admin feed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 4. FETCH COMMENTS FOR A POST
# ============================================
@community_feed_bp.route("/feed/posts/<int:post_id>/comments", methods=["GET"])
def get_post_comments(post_id):
    """Get all comments for a specific post"""
    try:
        # First verify post exists and is approved
        post_resp = supabase.table("community_feed_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post or post.get("deleted_at"):
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Check if comments are allowed
        if not post.get("allow_comments"):
            return jsonify({
                "status": "success",
                "comments": [],
                "message": "Comments are disabled on this post"
            }), 200
        
        # Fetch comments
        query = (
            supabase.table("community_feed_comments")
            .select("*")
            .eq("post_id", post_id)
            .is_("deleted_at", None)
            .order("created_at", desc=False)
        )
        
        resp = supabase_retry(lambda: query.execute())
        comments = getattr(resp, "data", []) or []
        
        # Enrich comments with user data
        enriched_comments = []
        for comment in comments:
            enriched_comments.append(await _enrich_comment(comment))
        
        return jsonify({
            "status": "success",
            "comments": enriched_comments
        }), 200
    
    except Exception as e:
        print(f"Error fetching comments: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 5. CREATE NEW POST
# ============================================
@community_feed_bp.route("/feed", methods=["POST"])
@token_required
def create_post():
    """Create a new community feed post"""
    try:
        user_id = request.user_id
        data = request.json or {}
        
        # Validate required fields
        title = data.get("title", "").strip()
        content = data.get("content", "").strip()
        category = data.get("category", "Other")
        address_barangay = data.get("address_barangay", "").strip()
        allow_comments = data.get("allow_comments", True)
        
        if not title or len(title) < 3:
            return jsonify({"status": "error", "message": "Title must be at least 3 characters"}), 400
        
        if not content or len(content) < 10:
            return jsonify({"status": "error", "message": "Content must be at least 10 characters"}), 400
        
        if not address_barangay:
            return jsonify({"status": "error", "message": "Barangay is required"}), 400
        
        # Check if this is user's first post
        first_post_resp = supabase.table("community_feed_posts").select(
            "id", count="exact"
        ).eq("user_id", user_id).is_("deleted_at", None).execute()
        
        is_first_time_post = (first_post_resp.count or 0) == 0
        
        # Create post
        new_post = {
            "user_id": user_id,
            "title": title,
            "content": content,
            "category": category,
            "address_barangay": address_barangay,
            "allow_comments": allow_comments,
            "is_first_time_post": is_first_time_post,
            "status": "approved"  # Auto-approve (change to "pending" for moderation)
        }
        
        post_resp = supabase_retry(lambda: supabase.table(
            "community_feed_posts"
        ).insert(new_post).execute())
        
        created_post = getattr(post_resp, "data", [{}])[0]
        
        # Enrich the response
        enriched_post = await _enrich_post(created_post)
        
        # Create notification for first-time posters
        if is_first_time_post:
            try:
                create_notification(
                    user_id=user_id,
                    type="community_first_post",
                    title="Welcome to Community Feed!",
                    message="Your first post has been published. Remember to keep posts related to community safety and incidents."
                )
            except Exception as notif_error:
                print(f"Notification error: {notif_error}")
        
        return jsonify({
            "status": "success",
            "message": "Post created successfully",
            "post": enriched_post,
            "is_first_post": is_first_time_post
        }), 201
    
    except Exception as e:
        print(f"Error creating post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 6. ADD COMMENT TO POST
# ============================================
@community_feed_bp.route("/feed/posts/<int:post_id>/comments", methods=["POST"])
@token_required
def add_comment(post_id):
    """Add a comment to a post"""
    try:
        user_id = request.user_id
        data = request.json or {}
        
        content = data.get("content", "").strip()
        
        if not content or len(content) < 1:
            return jsonify({"status": "error", "message": "Comment cannot be empty"}), 400
        
        # Verify post exists and comments are allowed
        post_resp = supabase.table("community_feed_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post or post.get("deleted_at"):
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        if not post.get("allow_comments"):
            return jsonify({"status": "error", "message": "Comments are disabled on this post"}), 403
        
        # Create comment
        new_comment = {
            "post_id": post_id,
            "user_id": user_id,
            "content": content
        }
        
        comment_resp = supabase_retry(lambda: supabase.table(
            "community_feed_comments"
        ).insert(new_comment).execute())
        
        created_comment = getattr(comment_resp, "data", [{}])[0]
        
        # Enrich the response
        enriched_comment = await _enrich_comment(created_comment)
        
        return jsonify({
            "status": "success",
            "message": "Comment added successfully",
            "comment": enriched_comment
        }), 201
    
    except Exception as e:
        print(f"Error adding comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 7. UPDATE POST
# ============================================
@community_feed_bp.route("/feed/posts/<int:post_id>", methods=["PUT"])
@token_required
def update_post(post_id):
    """Update a community feed post"""
    try:
        user_id = request.user_id
        data = request.json or {}
        
        # Verify ownership
        post_resp = supabase.table("community_feed_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post or post.get("deleted_at"):
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        if post.get("user_id") != user_id:
            return jsonify({"status": "error", "message": "You can only edit your own posts"}), 403
        
        # Prepare update
        update_data = {}
        if "title" in data:
            title = data["title"].strip()
            if len(title) < 3:
                return jsonify({"status": "error", "message": "Title must be at least 3 characters"}), 400
            update_data["title"] = title
        
        if "content" in data:
            content = data["content"].strip()
            if len(content) < 10:
                return jsonify({"status": "error", "message": "Content must be at least 10 characters"}), 400
            update_data["content"] = content
        
        if "category" in data:
            update_data["category"] = data["category"]
        
        if "allow_comments" in data:
            update_data["allow_comments"] = data["allow_comments"]
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        updated_resp = supabase_retry(lambda: supabase.table(
            "community_feed_posts"
        ).update(update_data).eq("id", post_id).execute())
        
        updated_post = getattr(updated_resp, "data", [{}])[0]
        enriched_post = await _enrich_post(updated_post)
        
        return jsonify({
            "status": "success",
            "message": "Post updated successfully",
            "post": enriched_post
        }), 200
    
    except Exception as e:
        print(f"Error updating post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 8. UPDATE COMMENT
# ============================================
@community_feed_bp.route("/feed/comments/<int:comment_id>", methods=["PUT"])
@token_required
def update_comment(comment_id):
    """Update a comment"""
    try:
        user_id = request.user_id
        data = request.json or {}
        
        content = data.get("content", "").strip()
        
        if not content:
            return jsonify({"status": "error", "message": "Comment cannot be empty"}), 400
        
        # Verify ownership
        comment_resp = supabase.table("community_feed_comments").select("*").eq("id", comment_id).execute()
        comment = getattr(comment_resp, "data", [None])[0]
        
        if not comment or comment.get("deleted_at"):
            return jsonify({"status": "error", "message": "Comment not found"}), 404
        
        if comment.get("user_id") != user_id:
            return jsonify({"status": "error", "message": "You can only edit your own comments"}), 403
        
        # Update
        update_data = {
            "content": content,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        updated_resp = supabase_retry(lambda: supabase.table(
            "community_feed_comments"
        ).update(update_data).eq("id", comment_id).execute())
        
        updated_comment = getattr(updated_resp, "data", [{}])[0]
        enriched_comment = await _enrich_comment(updated_comment)
        
        return jsonify({
            "status": "success",
            "message": "Comment updated successfully",
            "comment": enriched_comment
        }), 200
    
    except Exception as e:
        print(f"Error updating comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 9. DELETE POST (soft delete)
# ============================================
@community_feed_bp.route("/feed/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(post_id):
    """Delete a community feed post (soft delete)"""
    try:
        user_id = request.user_id
        
        # Verify ownership or admin
        post_resp = supabase.table("community_feed_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post or post.get("deleted_at"):
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Check user role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        is_admin_or_official = user and user.get("role") in ["Admin", "Barangay Official"]
        
        if post.get("user_id") != user_id and not is_admin_or_official:
            return jsonify({"status": "error", "message": "You can only delete your own posts"}), 403
        
        # Soft delete
        update_data = {
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase_retry(lambda: supabase.table(
            "community_feed_posts"
        ).update(update_data).eq("id", post_id).execute())
        
        return jsonify({
            "status": "success",
            "message": "Post deleted successfully"
        }), 200
    
    except Exception as e:
        print(f"Error deleting post: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 10. DELETE COMMENT (soft delete)
# ============================================
@community_feed_bp.route("/feed/comments/<int:comment_id>", methods=["DELETE"])
@token_required
def delete_comment(comment_id):
    """Delete a comment (soft delete)"""
    try:
        user_id = request.user_id
        
        # Verify ownership or admin
        comment_resp = supabase.table("community_feed_comments").select("*").eq("id", comment_id).execute()
        comment = getattr(comment_resp, "data", [None])[0]
        
        if not comment or comment.get("deleted_at"):
            return jsonify({"status": "error", "message": "Comment not found"}), 404
        
        # Check user role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        is_admin_or_official = user and user.get("role") in ["Admin", "Barangay Official"]
        
        if comment.get("user_id") != user_id and not is_admin_or_official:
            return jsonify({"status": "error", "message": "You can only delete your own comments"}), 403
        
        # Soft delete
        update_data = {
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase_retry(lambda: supabase.table(
            "community_feed_comments"
        ).update(update_data).eq("id", comment_id).execute())
        
        return jsonify({
            "status": "success",
            "message": "Comment deleted successfully"
        }), 200
    
    except Exception as e:
        print(f"Error deleting comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# 11. TOGGLE COMMENTS (ADMIN/OFFICIAL ONLY)
# ============================================
@community_feed_bp.route("/feed/posts/<int:post_id>/toggle-comments", methods=["PUT"])
@token_required
def toggle_comments(post_id):
    """Toggle comment allow/disallow on a post"""
    try:
        user_id = request.user_id
        data = request.json or {}
        allow_comments = data.get("allow_comments", True)
        
        # Check user role
        user_resp = supabase.table("users").select("role").eq("id", user_id).execute()
        user = getattr(user_resp, "data", [None])[0]
        
        if not user or user.get("role") not in ["Admin", "Barangay Official"]:
            return jsonify({"status": "error", "message": "Admin access required"}), 403
        
        # Verify post exists
        post_resp = supabase.table("community_feed_posts").select("*").eq("id", post_id).execute()
        post = getattr(post_resp, "data", [None])[0]
        
        if not post or post.get("deleted_at"):
            return jsonify({"status": "error", "message": "Post not found"}), 404
        
        # Update
        update_data = {
            "allow_comments": allow_comments,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        updated_resp = supabase_retry(lambda: supabase.table(
            "community_feed_posts"
        ).update(update_data).eq("id", post_id).execute())
        
        updated_post = getattr(updated_resp, "data", [{}])[0]
        
        return jsonify({
            "status": "success",
            "message": f"Comments {'enabled' if allow_comments else 'disabled'} for this post",
            "allow_comments": allow_comments
        }), 200
    
    except Exception as e:
        print(f"Error toggling comments: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ============================================
# HELPER FUNCTIONS
# ============================================

async def _enrich_post(post):
    """Enrich post data with user and comment info"""
    try:
        user_id = post.get("user_id")
        post_id = post.get("id")
        
        # Fetch user data
        user_resp = supabase.table("users").select(
            "id, firstname, lastname, avatar_url, role, email, isverified"
        ).eq("id", user_id).execute()
        user = getattr(user_resp, "data", [{}])[0]
        
        # Fetch user info (verification status)
        info_resp = supabase.table("info").select("verified").eq("user_id", user_id).execute()
        info = getattr(info_resp, "data", [{}])[0]
        
        # Count comments
        comments_resp = supabase.table("community_feed_comments").select(
            "id", count="exact"
        ).eq("post_id", post_id).is_("deleted_at", None).execute()
        comment_count = comments_resp.count or 0
        
        return {
            **post,
            "author": {
                "id": user.get("id"),
                "firstname": user.get("firstname"),
                "lastname": user.get("lastname"),
                "avatar_url": user.get("avatar_url"),
                "role": user.get("role"),
                "isverified": user.get("isverified"),
                "verified": info.get("verified", False)
            },
            "comment_count": comment_count
        }
    except Exception as e:
        print(f"Error enriching post: {e}")
        return post


async def _enrich_comment(comment):
    """Enrich comment data with user info"""
    try:
        user_id = comment.get("user_id")
        
        # Fetch user data
        user_resp = supabase.table("users").select(
            "id, firstname, lastname, avatar_url, role, email, isverified"
        ).eq("id", user_id).execute()
        user = getattr(user_resp, "data", [{}])[0]
        
        # Fetch user info
        info_resp = supabase.table("info").select("verified").eq("user_id", user_id).execute()
        info = getattr(info_resp, "data", [{}])[0]
        
        return {
            **comment,
            "author": {
                "id": user.get("id"),
                "firstname": user.get("firstname"),
                "lastname": user.get("lastname"),
                "avatar_url": user.get("avatar_url"),
                "role": user.get("role"),
                "isverified": user.get("isverified"),
                "verified": info.get("verified", False)
            }
        }
    except Exception as e:
        print(f"Error enriching comment: {e}")
        return comment
