-- Fix: RPC function timestamp and type mismatch
-- This fixes errors:
-- 1. "Returned type timestamp without time zone does not match expected type timestamp with time zone"
-- 2. "Returned type character varying(50) does not match expected type text"
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_users_with_verification(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  firstname VARCHAR(50),           -- ✅ Match users.firstname type
  lastname VARCHAR(50),            -- ✅ Match users.lastname type
  email VARCHAR(100),              -- ✅ Match users.email type
  role VARCHAR(50),                -- ✅ Match users.role type
  isverified BOOLEAN,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,  -- Expected return type
  verified BOOLEAN,
  fully_verified BOOLEAN,
  address_barangay TEXT            -- Cast ENUM to TEXT
) 
LANGUAGE plpgsql
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
    -- ✅ FIX: Cast timestamp to timestamptz
    u.created_at AT TIME ZONE 'UTC' as created_at,
    COALESCE(i.verified, false) as verified,
    COALESCE(i.verified, false) as fully_verified,
    i.address_barangay::TEXT as address_barangay  -- ✅ Cast ENUM to TEXT
  FROM users u
  LEFT JOIN info i ON u.id = i.user_id
  WHERE u.is_deleted IS NULL
  ORDER BY u.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_verification TO authenticated;

-- Verify the function signature
SELECT 
  routine_name,
  data_type,
  ordinal_position,
  parameter_name
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'get_users_with_verification'
ORDER BY ordinal_position;
