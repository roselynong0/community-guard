-- Migration: Create AI Usage Tracking Schema
-- Purpose: Track Smart Filter usage per user with free tier limits
-- Date: 2025-11-18

-- 1. Create ai_usage_logs table (event-level logging)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_email TEXT,
    barangay TEXT,
    interaction_type TEXT NOT NULL, -- e.g., 'smart_filter_session', 'smart_filter_toggle'
    duration_seconds INTEGER DEFAULT 0,
    usage_before_percent SMALLINT DEFAULT 0, -- Usage % before this interaction
    usage_after_percent SMALLINT, -- Usage % after this interaction (updated after aggregate update)
    week_start DATE NOT NULL, -- Start of the week this interaction occurred
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (timestamps, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT duration_non_negative CHECK (duration_seconds >= 0),
    CONSTRAINT usage_percent_range CHECK (usage_before_percent >= 0 AND usage_before_percent <= 100)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_week ON ai_usage_logs(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_interaction_type ON ai_usage_logs(interaction_type);

-- 2. Create ai_usage_aggregates table (weekly totals)
CREATE TABLE IF NOT EXISTS ai_usage_aggregates (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    total_seconds BIGINT DEFAULT 0, -- Total seconds used this week
    usage_percent SMALLINT DEFAULT 0, -- Percentage of 48 hours used (0-100)
    interaction_count INTEGER DEFAULT 0, -- Number of interactions this week
    is_premium BOOLEAN DEFAULT FALSE, -- Premium users always have 0% (unlimited access)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, week_start),
    CONSTRAINT total_seconds_non_negative CHECK (total_seconds >= 0),
    CONSTRAINT usage_percent_range CHECK (usage_percent >= 0 AND usage_percent <= 100),
    CONSTRAINT interaction_count_non_negative CHECK (interaction_count >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_aggregates_user_week ON ai_usage_aggregates(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_aggregates_updated_at ON ai_usage_aggregates(updated_at DESC);

-- 3. Create view for current week usage
CREATE OR REPLACE VIEW vw_ai_current_week_usage AS
SELECT
    user_id,
    week_start,
    total_seconds,
    usage_percent,
    interaction_count,
    is_premium,
    CASE
        WHEN is_premium THEN 999 -- Unlimited
        ELSE GREATEST(0, ROUND((172800 - total_seconds)::numeric / 3600, 2)::integer) -- Hours remaining
    END as hours_remaining
FROM ai_usage_aggregates
WHERE week_start = date_trunc('week', now())::date;

-- 4. Create log_ai_interaction() function (PL/pgSQL)
CREATE OR REPLACE FUNCTION log_ai_interaction(
    p_user_id UUID,
    p_interaction_type TEXT,
    p_duration_seconds INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    user_id UUID,
    week_start DATE,
    total_seconds BIGINT,
    usage_percent SMALLINT,
    interaction_count INTEGER,
    is_premium BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE := date_trunc('week', now())::date;
    v_is_premium BOOLEAN := FALSE;
    v_before_seconds BIGINT := 0;
    v_before_percent SMALLINT := 0;
    v_before_interaction_count INTEGER := 0;
    v_new_total BIGINT := 0;
    v_new_percent SMALLINT := 0;
    v_new_interaction_count INTEGER := 0;
BEGIN
    -- Determine premium status
    BEGIN
        SELECT is_premium INTO v_is_premium FROM users WHERE id = p_user_id;
    EXCEPTION WHEN undefined_column THEN
        v_is_premium := FALSE;
    END;

    -- Get current aggregate (if any)
    SELECT total_seconds, usage_percent, interaction_count
    INTO v_before_seconds, v_before_percent, v_before_interaction_count
    FROM ai_usage_aggregates
    WHERE user_id = p_user_id AND week_start = v_week_start
    LIMIT 1;

    IF NOT FOUND THEN
        v_before_seconds := 0;
        v_before_percent := 0;
        v_before_interaction_count := 0;
    END IF;

    -- Insert event log (before updating aggregates)
    INSERT INTO ai_usage_logs (
        user_id,
        user_email,
        barangay,
        interaction_type,
        duration_seconds,
        usage_before_percent,
        week_start,
        metadata,
        created_at
    )
    VALUES (
        p_user_id,
        (SELECT email FROM auth.users WHERE id = p_user_id),
        (SELECT NULLIF(info.address_barangay::text, '') FROM info WHERE info.user_id = p_user_id LIMIT 1),
        p_interaction_type,
        p_duration_seconds,
        v_before_percent,
        v_week_start,
        p_metadata,
        now()
    );

    -- Update or insert into aggregates
    IF v_is_premium THEN
        -- Premium users: usage_percent always 0
        INSERT INTO ai_usage_aggregates (user_id, week_start, total_seconds, usage_percent, interaction_count, is_premium, updated_at)
        VALUES (p_user_id, v_week_start, p_duration_seconds, 0, 1, TRUE, now())
        ON CONFLICT (user_id, week_start) DO UPDATE
        SET total_seconds = ai_usage_aggregates.total_seconds + EXCLUDED.total_seconds,
            interaction_count = ai_usage_aggregates.interaction_count + 1,
            is_premium = TRUE,
            updated_at = now();
    ELSE
        -- Non-premium: compute usage_percent relative to 48h (172800 seconds)
        INSERT INTO ai_usage_aggregates (user_id, week_start, total_seconds, usage_percent, interaction_count, is_premium, updated_at)
        VALUES (p_user_id, v_week_start, p_duration_seconds,
                LEAST(100, ROUND(p_duration_seconds::numeric / 172800 * 100)::int),
                1, FALSE, now())
        ON CONFLICT (user_id, week_start) DO UPDATE
        SET total_seconds = ai_usage_aggregates.total_seconds + EXCLUDED.total_seconds,
            interaction_count = ai_usage_aggregates.interaction_count + 1,
            usage_percent = LEAST(100, ROUND((ai_usage_aggregates.total_seconds + EXCLUDED.total_seconds)::numeric / 172800 * 100)::int),
            updated_at = now();
    END IF;

    -- Fetch updated aggregate
    SELECT total_seconds, usage_percent, interaction_count
    INTO v_new_total, v_new_percent, v_new_interaction_count
    FROM ai_usage_aggregates
    WHERE user_id = p_user_id AND week_start = v_week_start;

    -- Update the log with usage_after_percent
    UPDATE ai_usage_logs
    SET usage_after_percent = v_new_percent
    WHERE user_id = p_user_id AND week_start = v_week_start
      AND usage_after_percent IS NULL
      AND created_at >= now() - interval '1 minute';

    -- Return result
    user_id := p_user_id;
    week_start := v_week_start;
    total_seconds := v_new_total;
    usage_percent := v_new_percent;
    interaction_count := v_new_interaction_count;
    is_premium := v_is_premium;

    RETURN NEXT;
END;
$$;

-- 5. Enable RLS policies for security
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_aggregates ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage logs
CREATE POLICY "Users can read their own ai_usage_logs"
    ON ai_usage_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only read their own aggregates
CREATE POLICY "Users can read their own ai_usage_aggregates"
    ON ai_usage_aggregates
    FOR SELECT
    USING (auth.uid() = user_id);

-- Function permissions (allow authenticated users to call)
GRANT EXECUTE ON FUNCTION log_ai_interaction(UUID, TEXT, INTEGER, JSONB) TO authenticated;

-- Grant access to views
GRANT SELECT ON vw_ai_current_week_usage TO authenticated;

-- ===== FIX FOREIGN KEY CONSTRAINTS =====
-- Drop old foreign key constraints that reference auth.users
ALTER TABLE ai_usage_logs
DROP CONSTRAINT IF EXISTS ai_usage_logs_user_id_fkey;

ALTER TABLE ai_usage_aggregates
DROP CONSTRAINT IF EXISTS ai_usage_aggregates_user_id_fkey;

-- Add correct foreign key constraints referencing public.users
ALTER TABLE ai_usage_logs
ADD CONSTRAINT ai_usage_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ai_usage_aggregates
ADD CONSTRAINT ai_usage_aggregates_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ===== ADD PREMIUM COLUMN TO USERS TABLE =====
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onpremium BOOLEAN DEFAULT FALSE;
