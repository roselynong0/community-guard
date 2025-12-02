-- Migration: Add is_rejected column to community_posts
-- This allows rejected posts to be shown to the owner for acknowledgment before permanent deletion

ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_community_posts_is_rejected ON community_posts(is_rejected);
