-- Migration: Add is_accepted column to community_posts
-- This allows posts to be accepted without being fully approved

ALTER TABLE community_posts 
ADD COLUMN IF NOT EXISTS is_accepted BOOLEAN DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_community_posts_is_accepted ON community_posts(is_accepted);

-- Comment for clarity
COMMENT ON COLUMN community_posts.is_accepted IS 'When true, post is accepted and displays normally even if status is pending';
