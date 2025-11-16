-- Migration: 009_barangay_moderation.sql
-- Adds helper functions/views for barangay-specific post reading and admin pending queries

-- Function: get_pending_posts_admin(p_limit integer DEFAULT 50)
-- Returns pending posts (admin use). Note: permission checks should be enforced at the API layer.
CREATE OR REPLACE FUNCTION get_pending_posts_admin(p_limit integer DEFAULT 50)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  title text,
  content text,
  post_type text,
  barangay text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.id, cp.user_id, cp.title, cp.content, cp.post_type, cp.barangay, cp.status, cp.created_at, cp.updated_at
  FROM community_posts cp
  WHERE cp.status = 'pending' AND cp.deleted_at IS NULL
  ORDER BY cp.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function: get_approved_posts_for_barangay(p_barangay text, p_limit integer DEFAULT 50)
-- Returns approved posts for a given barangay with newest first. Intended for barangay officials and public display.
CREATE OR REPLACE FUNCTION get_approved_posts_for_barangay(p_barangay text, p_limit integer DEFAULT 50)
RETURNS TABLE(
  id bigint,
  user_id uuid,
  title text,
  content text,
  post_type text,
  barangay text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.id, cp.user_id, cp.title, cp.content, cp.post_type, cp.barangay, cp.status, cp.created_at, cp.updated_at
  FROM community_posts cp
  WHERE cp.status = 'approved' AND cp.deleted_at IS NULL
    AND (p_barangay IS NULL OR p_barangay = '' OR cp.barangay = p_barangay)
  ORDER BY cp.is_pinned DESC, cp.created_at DESC
  LIMIT p_limit;
END;
$$;

-- NOTE: These helper functions return the raw post rows; the application API should enrich them with author info and comment counts as appropriate and enforce role-based access control (admin-only pending endpoint).
