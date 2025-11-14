-- Migration: Approve existing ONGOING and RESOLVED reports
-- Updates all existing reports with "Ongoing" or "Resolved" status to is_approved = TRUE
-- This ensures these reports are visible publicly immediately (already approved)
-- Only pending reports will show the pending design

UPDATE reports 
SET is_approved = TRUE, 
    approved_at = CASE 
        WHEN created_at IS NOT NULL THEN created_at 
        ELSE NOW() 
    END
WHERE status IN ('Ongoing', 'Resolved') 
  AND is_approved IS NOT TRUE;

-- Verify the update
SELECT COUNT(*) as approved_count, status 
FROM reports 
WHERE is_approved = TRUE 
GROUP BY status;
