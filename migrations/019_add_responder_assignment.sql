-- Migration: Add responder assignment columns to reports table
-- This migration adds columns to track which responder is assigned to a report

-- Add assigned_responder_id column (UUID)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS assigned_responder_id UUID REFERENCES users(id);

-- Add timestamp for when the assignment was made
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Add who made the assignment (UUID)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);

-- Create index for faster lookups of assigned reports
CREATE INDEX IF NOT EXISTS idx_reports_assigned_responder 
ON reports(assigned_responder_id) 
WHERE assigned_responder_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN reports.assigned_responder_id IS 'UUID of the responder assigned to this report';
COMMENT ON COLUMN reports.assigned_at IS 'Timestamp when the responder was assigned';
COMMENT ON COLUMN reports.assigned_by IS 'UUID of the user (barangay official) who made the assignment';
