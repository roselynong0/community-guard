-- Migration: Add approval workflow to reports
-- Adds is_approved column to implement post approval workflow
-- Posts are hidden from public view until approved by admin/barangay official

-- Add is_approved column to reports table
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN reports.is_approved IS 'Indicates if report has been approved by admin/barangay official for public visibility';

-- Add approved_by column to track who approved the report
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Add approved_at column to track when report was approved
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Example usage:
-- Approve a report: UPDATE reports SET is_approved = true, approved_by = '<user_uuid>', approved_at = NOW() WHERE id = '<report_id>';
