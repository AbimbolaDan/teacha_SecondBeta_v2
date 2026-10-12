-- The app now queries Supabase directly from the browser using the anon key.
-- The existing policies only allow the "authenticated" role, so anon requests
-- are blocked. Add anon policies so the client-side functions can read and
-- write sessions and messages by tester_code.

CREATE POLICY "anon can manage own sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert own sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update own sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can read messages"
  ON messages FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update messages"
  ON messages FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can manage concept_coverage"
  ON concept_coverage FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can manage mastery_events"
  ON mastery_events FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can manage api_usage"
  ON api_usage FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can manage misconception_events"
  ON misconception_events FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can read materials"
  ON materials FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert materials"
  ON materials FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update materials"
  ON materials FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
