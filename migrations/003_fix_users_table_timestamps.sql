-- ALTERNATIVE FIX: Convert users table timestamps to TIMESTAMPTZ
-- This is a more permanent solution but requires table alteration
-- ⚠️ WARNING: Only run this if Option 1 doesn't work or you want a permanent fix

-- Convert created_at column
ALTER TABLE users 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE 
USING created_at AT TIME ZONE 'UTC';

-- Convert updated_at column
ALTER TABLE users 
ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE 
USING updated_at AT TIME ZONE 'UTC';

-- Convert is_deleted column (soft delete timestamp)
ALTER TABLE users 
ALTER COLUMN is_deleted TYPE TIMESTAMP WITH TIME ZONE 
USING is_deleted AT TIME ZONE 'UTC';

-- Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('created_at', 'updated_at', 'is_deleted');

-- Now update the RPC function (match exact database column types)
CREATE OR REPLACE FUNCTION get_users_with_verification(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  firstname VARCHAR(50),           -- ✅ Match users.firstname
  lastname VARCHAR(50),            -- ✅ Match users.lastname
  email VARCHAR(100),              -- ✅ Match users.email
  role VARCHAR(50),                -- ✅ Match users.role
  isverified BOOLEAN,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN,
  fully_verified BOOLEAN,
  address_barangay TEXT            -- Cast ENUM to TEXT for JSON serialization
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
    u.created_at,  -- ✅ No cast needed after table alteration
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

GRANT EXECUTE ON FUNCTION get_users_with_verification TO authenticated;
