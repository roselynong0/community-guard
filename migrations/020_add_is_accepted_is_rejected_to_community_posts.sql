-- Migration: Add is_accepted and is_rejected columns to community_posts
-- These columns are used for moderation workflow:
-- - is_accepted: Pre-approval that makes post visible without full approval (Admin/Official decision)
-- - is_rejected: Marks post as rejected with reason tracked in audit table

-- Add is_accepted column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' AND column_name = 'is_accepted'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN is_accepted BOOLEAN DEFAULT false;
        
        COMMENT ON COLUMN community_posts.is_accepted IS 'Pre-approval flag - post visible to community but pending full approval';
    END IF;
END $$;

-- Add is_rejected column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' AND column_name = 'is_rejected'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN is_rejected BOOLEAN DEFAULT false;
        
        COMMENT ON COLUMN community_posts.is_rejected IS 'Rejection flag - post hidden from community feed';
    END IF;
END $$;

-- Add rejection_reason column if it doesn't exist (stores reason for rejection)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'community_posts' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE community_posts 
        ADD COLUMN rejection_reason TEXT;
        
        COMMENT ON COLUMN community_posts.rejection_reason IS 'Reason for post rejection (if is_rejected = true)';
    END IF;
END $$;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_community_posts_is_accepted ON community_posts(is_accepted) WHERE is_accepted = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_is_rejected ON community_posts(is_rejected) WHERE is_rejected = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);

-- Update existing approved posts to have is_accepted = true for backward compatibility
UPDATE community_posts 
SET is_accepted = true 
WHERE status = 'approved' AND is_accepted IS NULL;

-- Verify the community_posts_status_audit table exists (for tracking moderation actions)
CREATE TABLE IF NOT EXISTS community_posts_status_audit (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create index on audit table for faster lookups
CREATE INDEX IF NOT EXISTS idx_community_posts_status_audit_post_id ON community_posts_status_audit(post_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_status_audit_changed_by ON community_posts_status_audit(changed_by);

-- Summary of community_posts table structure after migration:
-- id BIGINT PRIMARY KEY
-- user_id UUID NOT NULL (FK to users)
-- title VARCHAR(255) NOT NULL
-- content TEXT NOT NULL
-- post_type VARCHAR(50) NOT NULL
-- barangay VARCHAR(100) NOT NULL
-- is_pinned BOOLEAN DEFAULT false
-- allow_comments BOOLEAN DEFAULT true
-- created_at TIMESTAMPTZ
-- updated_at TIMESTAMPTZ
-- deleted_at TIMESTAMPTZ
-- status VARCHAR(50) DEFAULT 'pending'
-- is_accepted BOOLEAN DEFAULT false  <- NEW
-- is_rejected BOOLEAN DEFAULT false  <- NEW
-- rejection_reason TEXT              <- NEW
