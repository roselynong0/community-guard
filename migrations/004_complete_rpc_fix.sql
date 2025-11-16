-- ============================================================================
-- COMPLETE FIX: RPC Function for get_users_with_verification
-- ============================================================================
-- This script fixes ALL type mismatches between the RPC function and database schema
--
-- Issues Fixed:
-- 1. ❌ timestamp without time zone → ✅ timestamp with time zone
-- 2. ❌ character varying(50) → ✅ varchar(50) (exact match)
-- 3. ❌ olongapo_barangay ENUM → ✅ TEXT (for JSON serialization)
--
-- Run this entire script in your Supabase SQL Editor
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_users_with_verification(INTEGER, INTEGER);

-- Create the corrected function
CREATE OR REPLACE FUNCTION get_users_with_verification(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  firstname VARCHAR(50),           -- ✅ Exact match: users.firstname
  lastname VARCHAR(50),            -- ✅ Exact match: users.lastname
  email VARCHAR(100),              -- ✅ Exact match: users.email
  role VARCHAR(50),                -- ✅ Exact match: users.role
  isverified BOOLEAN,              -- ✅ Exact match: users.isverified
  avatar_url TEXT,                 -- ✅ Exact match: users.avatar_url
  created_at TIMESTAMP WITH TIME ZONE,  -- ✅ Cast from TIMESTAMP to TIMESTAMPTZ
  verified BOOLEAN,                -- ✅ From info.verified with COALESCE
  fully_verified BOOLEAN,          -- ✅ Duplicate of verified (for compatibility)
  address_barangay TEXT            -- ✅ Cast from olongapo_barangay ENUM to TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's privileges
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.firstname,
    u.lastname,
    u.email,
    u.role,
    u.isverified,
    u.avatar_url,
    -- Cast TIMESTAMP to TIMESTAMPTZ (assumes UTC)
    u.created_at AT TIME ZONE 'UTC' as created_at,
    -- Return FALSE if no info record exists
    COALESCE(i.verified, false) as verified,
    COALESCE(i.verified, false) as fully_verified,
    -- Cast ENUM to TEXT for JSON compatibility
    i.address_barangay::TEXT as address_barangay
  FROM users u
  LEFT JOIN info i ON u.id = i.user_id
  WHERE u.is_deleted IS NULL  -- Exclude soft-deleted users
  ORDER BY u.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Grant execute permission to authenticated users (your API service role)
GRANT EXECUTE ON FUNCTION get_users_with_verification TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_verification TO anon;
GRANT EXECUTE ON FUNCTION get_users_with_verification TO service_role;

-- Create performance index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC) 
WHERE is_deleted IS NULL;

-- Create index for JOIN performance
CREATE INDEX IF NOT EXISTS idx_info_user_id 
ON info(user_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify the function exists and has correct signature
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_users_with_verification';

-- 2. Check the function's return type structure
SELECT 
  parameter_name,
  data_type,
  ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'get_users_with_verification'
  AND parameter_mode = 'OUT'
ORDER BY ordinal_position;

-- 3. Test the function with a small limit
SELECT * FROM get_users_with_verification(5, 0);

-- ============================================================================
-- Expected Output:
-- ✅ Function created successfully
-- ✅ Returns 11 columns with correct types
-- ✅ Test query returns user data without errors
-- ============================================================================

-- 4. Performance comparison (optional - comment out if not needed)
-- EXPLAIN ANALYZE 
-- SELECT * FROM get_users_with_verification(50, 0);
