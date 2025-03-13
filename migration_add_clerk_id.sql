-- Add clerk_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS clerk_id TEXT;

-- Create an index for faster lookups by clerk_id
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- For existing users (if any), we'll need to update them manually 
-- or through the application after this migration

-- First, make sure RLS is enabled on the table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Then create the policy
CREATE POLICY "users_policy" 
ON users
FOR ALL
USING (
  auth.uid()::uuid = id OR 
  auth.uid()::text = clerk_id
);

-- If you need to replace an existing policy, drop it first
-- Uncomment the line below if needed
-- DROP POLICY IF EXISTS "Users can only access their own data" ON users; 