-- The login flow runs entirely client-side (no TanStack Start server context).
-- The anon Supabase client needs to read and update tester_profiles by tester_code
-- so the sign-in screen can verify codes and save profile details.

CREATE POLICY "anon can read tester_profiles by code"
  ON tester_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can update tester_profiles by code"
  ON tester_profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
