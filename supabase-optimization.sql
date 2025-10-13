-- Supabase SQL Function for optimized user queries
-- Run this in your Supabase SQL editor to improve performance

CREATE OR REPLACE FUNCTION get_users_with_verification(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  firstname TEXT,
  lastname TEXT,
  email TEXT,
  role TEXT,
  isverified BOOLEAN,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  verified BOOLEAN,
  fully_verified BOOLEAN,
  address_barangay TEXT
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
    u.created_at,
    COALESCE(i.verified, false) as verified,
    COALESCE(i.verified, false) as fully_verified,
    i.address_barangay
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

-- Create index for better performance if not exists
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC) WHERE is_deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_info_user_id ON info(user_id);