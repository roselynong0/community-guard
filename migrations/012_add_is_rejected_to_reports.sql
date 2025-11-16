-- Migration: Add rejection workflow to reports
-- Adds is_rejected column to implement report rejection workflow
-- Rejected reports are hidden from public view and shown in red to users with rejection reasons

-- Add is_rejected column to reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN reports.is_rejected IS 'Indicates if report has been rejected by admin/barangay official. When rejected, user sees red design with rejection info';

-- Add rejected_by column to track who rejected the report
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS rejected_by UUID;

-- Add rejected_at column to track when report was rejected
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Add rejection_reason column to store why it was rejected
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for better query performance on rejected reports
CREATE INDEX IF NOT EXISTS idx_reports_is_rejected ON reports(is_rejected);
CREATE INDEX IF NOT EXISTS idx_reports_rejected_at ON reports(rejected_at);

-- Example usage:
-- Reject a report: 
-- UPDATE reports 
-- SET is_rejected = true, rejected_by = '<user_uuid>', rejected_at = NOW(), rejection_reason = 'Violates community guidelines'
-- WHERE id = '<report_id>';
