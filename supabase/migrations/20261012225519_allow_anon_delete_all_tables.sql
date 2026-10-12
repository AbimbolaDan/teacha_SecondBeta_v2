-- Add anon DELETE policies for the delete-my-data flow.
-- The app deletes rows directly from the browser using the anon client.

CREATE POLICY "anon can delete messages"
  ON messages FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete concept_coverage"
  ON concept_coverage FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete mastery_events"
  ON mastery_events FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete misconception_events"
  ON misconception_events FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete sessions"
  ON sessions FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete materials"
  ON materials FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete tester_profiles"
  ON tester_profiles FOR DELETE
  TO anon
  USING (true);
