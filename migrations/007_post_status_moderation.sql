-- ============================================
-- Migration: Post Status & Moderation Functions
-- ============================================
-- Adds moderation functions and procedures for managing post status
-- Supports 'pending' and 'approved' statuses with audit trail

-- ============================================
-- Create Post Status Audit Table
-- ============================================
-- Tracks all status changes for audit purposes

CREATE TABLE IF NOT EXISTS community_posts_status_audit (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_posts_status_audit_post_id ON community_posts_status_audit(post_id);
CREATE INDEX IF NOT EXISTS idx_posts_status_audit_changed_by ON community_posts_status_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_posts_status_audit_created_at ON community_posts_status_audit(created_at DESC);

-- ============================================
-- Function: Approve Post
-- ============================================
-- Changes post status from 'pending' to 'approved'
-- Only Admin can approve posts

CREATE OR REPLACE FUNCTION approve_community_post(
    p_post_id BIGINT,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    post_id BIGINT,
    new_status VARCHAR(50)
) AS $$
DECLARE
    v_post_status VARCHAR(50);
    v_user_role VARCHAR(50);
BEGIN
    -- Check if user has permission to approve
    SELECT role INTO v_user_role FROM users WHERE id = p_admin_id;
    
    IF v_user_role NOT IN ('Admin') THEN
        RETURN QUERY SELECT false, 'Only Admin can approve posts', p_post_id::BIGINT, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Check if post exists
    SELECT status INTO v_post_status FROM community_posts WHERE id = p_post_id;
    
    IF v_post_status IS NULL THEN
        RETURN QUERY SELECT false, 'Post not found', p_post_id::BIGINT, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Check if already approved
    IF v_post_status = 'approved' THEN
        RETURN QUERY SELECT false, 'Post is already approved', p_post_id::BIGINT, v_post_status;
        RETURN;
    END IF;
    
    -- Update post status
    UPDATE community_posts
    SET status = 'approved', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_post_id;
    
    -- Log the status change
    INSERT INTO community_posts_status_audit (post_id, old_status, new_status, changed_by, reason)
    VALUES (p_post_id, v_post_status, 'approved', p_admin_id, p_reason);
    
    RETURN QUERY SELECT true, 'Post approved successfully', p_post_id::BIGINT, 'approved'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Reject/Revert to Pending
-- ============================================
-- Changes post status from 'approved' back to 'pending'

CREATE OR REPLACE FUNCTION reject_community_post(
    p_post_id BIGINT,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    post_id BIGINT,
    new_status VARCHAR(50)
) AS $$
DECLARE
    v_post_status VARCHAR(50);
    v_user_role VARCHAR(50);
BEGIN
    -- Check if user has permission to reject
    SELECT role INTO v_user_role FROM users WHERE id = p_admin_id;
    
    IF v_user_role NOT IN ('Admin') THEN
        RETURN QUERY SELECT false, 'Only Admin can reject posts', p_post_id::BIGINT, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Check if post exists
    SELECT status INTO v_post_status FROM community_posts WHERE id = p_post_id;
    
    IF v_post_status IS NULL THEN
        RETURN QUERY SELECT false, 'Post not found', p_post_id::BIGINT, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Update post status
    UPDATE community_posts
    SET status = 'pending', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_post_id;
    
    -- Log the status change
    INSERT INTO community_posts_status_audit (post_id, old_status, new_status, changed_by, reason)
    VALUES (p_post_id, v_post_status, 'pending', p_admin_id, p_reason);
    
    RETURN QUERY SELECT true, 'Post reverted to pending', p_post_id::BIGINT, 'pending'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get Pending Posts
-- ============================================
-- Retrieves all posts with 'pending' status for moderation

CREATE OR REPLACE FUNCTION get_pending_posts(
    p_barangay VARCHAR(100) DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE(
    id BIGINT,
    user_id UUID,
    title VARCHAR(255),
    content TEXT,
    post_type VARCHAR(50),
    barangay VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    author_firstname VARCHAR(50),
    author_lastname VARCHAR(50),
    author_role VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.id,
        cp.user_id,
        cp.title,
        cp.content,
        cp.post_type,
        cp.barangay,
        cp.status,
        cp.created_at,
        u.firstname,
        u.lastname,
        u.role
    FROM community_posts cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.status = 'pending'
        AND (p_barangay IS NULL OR cp.barangay = p_barangay)
        AND cp.deleted_at IS NULL
    ORDER BY cp.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get Status Audit Trail
-- ============================================
-- Retrieves the complete audit trail for a post's status changes

CREATE OR REPLACE FUNCTION get_post_status_audit(p_post_id BIGINT)
RETURNS TABLE(
    id BIGINT,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by_name TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cpa.id,
        cpa.old_status,
        cpa.new_status,
        (u.firstname || ' ' || u.lastname)::TEXT,
        cpa.reason,
        cpa.created_at
    FROM community_posts_status_audit cpa
    LEFT JOIN users u ON cpa.changed_by = u.id
    WHERE cpa.post_id = p_post_id
    ORDER BY cpa.created_at DESC;
END;
$$ LANGUAGE plpgsql;
