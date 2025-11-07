-- Migration: Add image support to reports table
-- This allows storing base64 encoded images directly in the database
-- Run this in your Supabase SQL Editor

-- Add image_url column to reports table (can store base64 or URL)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN reports.image_url IS 'Stores image as base64 data URL (data:image/jpeg;base64,...) or file path';

-- Optional: Add multiple images support (JSONB array)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN reports.images IS 'Array of base64 image data URLs for reports with multiple images';

-- Example usage:
-- Single image: UPDATE reports SET image_url = 'data:image/jpeg;base64,/9j/4AAQ...' WHERE id = 'uuid';
-- Multiple images: UPDATE reports SET images = '["data:image/jpeg;base64,...", "data:image/png;base64,..."]'::jsonb WHERE id = 'uuid';
