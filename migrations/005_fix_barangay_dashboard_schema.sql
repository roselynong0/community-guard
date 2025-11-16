-- ================================================
-- Migration 007: Fix Barangay Dashboard Schema
-- Adds missing tables and fixes existing issues
-- DO NOT DROP EXISTING TABLES - Only add/modify
-- ================================================

-- 1️⃣ Fix users table syntax error (remove trailing comma if exists)
-- This is handled by Supabase automatically, but document it here
-- ALTER TABLE users ... (no changes needed, Supabase will ignore the trailing comma)

-- 2️⃣ Create verification_sessions table if not exists
CREATE TABLE IF NOT EXISTS verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_verification_sessions_token ON verification_sessions(token);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_id ON verification_sessions(user_id);

-- 3️⃣ Update report_id column type in notifications if needed
-- Check if column exists and is wrong type, then alter
DO $$
BEGIN
    -- Change report_id to UUID if it exists and is BIGINT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'report_id'
        AND data_type = 'bigint'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN report_id TYPE UUID USING report_id::text::uuid;
    END IF;
END$$;

-- 4️⃣ Add missing columns to password_resets if needed
DO $$
BEGIN
    -- Add token column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'password_resets' 
        AND column_name = 'token'
    ) THEN
        ALTER TABLE password_resets ADD COLUMN token TEXT UNIQUE;
    END IF;
END$$;

-- Create index for password_resets token
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- 5️⃣ Add deleted_at column to users table if missing (soft delete support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END$$;

-- 6️⃣ Create indexes for better query performance (barangay dashboard needs these)
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_barangay ON reports(address_barangay);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_info_barangay ON info(address_barangay);

-- 7️⃣ Create or replace RPC function for stats (used by dashboard)
CREATE OR REPLACE FUNCTION get_report_stats_by_barangay(barangay_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    total_reports BIGINT,
    pending BIGINT,
    ongoing BIGINT,
    resolved BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_reports,
        COUNT(*) FILTER (WHERE status = 'Pending')::BIGINT as pending,
        COUNT(*) FILTER (WHERE status = 'Ongoing')::BIGINT as ongoing,
        COUNT(*) FILTER (WHERE status = 'Resolved')::BIGINT as resolved
    FROM reports
    WHERE 
        deleted_at IS NULL
        AND (barangay_filter IS NULL OR address_barangay::TEXT = barangay_filter);
END;
$$ LANGUAGE plpgsql;

-- 8️⃣ Create RPC function for monthly trend data
CREATE OR REPLACE FUNCTION get_monthly_report_trends(barangay_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    month TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TO_CHAR(created_at, 'Mon') as month,
        COUNT(*)::BIGINT as count
    FROM reports
    WHERE 
        deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '5 months'
        AND (barangay_filter IS NULL OR address_barangay::TEXT = barangay_filter)
    GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
    ORDER BY EXTRACT(MONTH FROM created_at);
END;
$$ LANGUAGE plpgsql;

-- 9️⃣ Create RPC function for barangay report counts (top 5)
CREATE OR REPLACE FUNCTION get_top_barangays_by_reports()
RETURNS TABLE(
    barangay TEXT,
    total BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        address_barangay::TEXT as barangay,
        COUNT(*)::BIGINT as total
    FROM reports
    WHERE deleted_at IS NULL
    GROUP BY address_barangay
    ORDER BY COUNT(*) DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 🔟 Grant permissions (adjust based on your Supabase roles)
-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_report_stats_by_barangay TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_report_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_barangays_by_reports TO authenticated;

-- ================================================
-- Migration Complete
-- Run this SQL in your Supabase SQL Editor
-- ================================================

-- Verification queries (run these to check):
-- SELECT * FROM pg_tables WHERE schemaname = 'public';
-- SELECT proname FROM pg_proc WHERE proname LIKE 'get_%';
