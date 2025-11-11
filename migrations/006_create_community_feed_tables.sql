-- Community Feed Tables Migration
-- Creates tables for community posts and comments

-- 1. Community Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    post_type VARCHAR(50) NOT NULL, -- 'incident', 'safety', 'suggestion', 'recommendation', 'general'
    barangay VARCHAR(100) NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    allow_comments BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 2. Community Comments Table
CREATE TABLE IF NOT EXISTS community_comments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 3. Community Post Reactions/Likes Table (optional, for future use)
CREATE TABLE IF NOT EXISTS community_post_reactions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) DEFAULT 'like', -- 'like', 'helpful', 'insightful'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(post_id, user_id, reaction_type)
);

-- Create indexes for performance
CREATE INDEX idx_community_posts_barangay ON community_posts(barangay);
CREATE INDEX idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX idx_community_posts_post_type ON community_posts(post_type);
CREATE INDEX idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX idx_community_comments_user_id ON community_comments(user_id);
CREATE INDEX idx_community_post_reactions_post_id ON community_post_reactions(post_id);

-- ============================================
-- ALTER TABLE: Add Status Column
-- ============================================
-- Adds status tracking for post moderation workflow
-- Status values: 'pending' (default for new posts), 'approved' (verified by admin)

ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);

-- ============================================
-- Status Update Trigger Function
-- ============================================
-- Automatically updates the 'updated_at' timestamp when status changes

CREATE OR REPLACE FUNCTION update_post_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF NOT EXISTS post_status_update_trigger ON community_posts;

-- Create trigger for status updates
CREATE TRIGGER post_status_update_trigger
BEFORE UPDATE ON community_posts
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_post_status_timestamp();
