-- Migration: Create report_reactions table for heart/like functionality
-- This enables users to react to reports and track engagement for trending algorithm

-- Create the report_reactions table
CREATE TABLE IF NOT EXISTS report_reactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),

    CONSTRAINT report_reactions_pkey PRIMARY KEY (id),
    
    -- Each user can only have one reaction per report
    CONSTRAINT report_reactions_unique_user_report UNIQUE (report_id, user_id),

    CONSTRAINT report_reactions_report_id_fkey FOREIGN KEY (report_id)
        REFERENCES reports(id)
        ON DELETE CASCADE,

    CONSTRAINT report_reactions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_report_reactions_report_id ON report_reactions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_reactions_user_id ON report_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_report_reactions_created_at ON report_reactions(created_at DESC);

-- Add reaction_count column to reports table for quick access (denormalized for performance)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'reaction_count'
    ) THEN
        ALTER TABLE reports 
        ADD COLUMN reaction_count INTEGER DEFAULT 0;
        
        COMMENT ON COLUMN reports.reaction_count IS 'Cached count of reactions for performance';
    END IF;
END $$;

-- Create function to update reaction_count on reports table
CREATE OR REPLACE FUNCTION update_report_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reports SET reaction_count = COALESCE(reaction_count, 0) + 1 WHERE id = NEW.report_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reports SET reaction_count = GREATEST(0, COALESCE(reaction_count, 0) - 1) WHERE id = OLD.report_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update reaction_count
DROP TRIGGER IF EXISTS trigger_update_report_reaction_count ON report_reactions;
CREATE TRIGGER trigger_update_report_reaction_count
AFTER INSERT OR DELETE ON report_reactions
FOR EACH ROW EXECUTE FUNCTION update_report_reaction_count();

-- Initialize reaction_count for existing reports
UPDATE reports r
SET reaction_count = (
    SELECT COUNT(*) FROM report_reactions rr WHERE rr.report_id = r.id
)
WHERE reaction_count IS NULL OR reaction_count = 0;

-- Comment on table
COMMENT ON TABLE report_reactions IS 'Stores user reactions (likes/hearts) on reports for engagement tracking and trending algorithm';
