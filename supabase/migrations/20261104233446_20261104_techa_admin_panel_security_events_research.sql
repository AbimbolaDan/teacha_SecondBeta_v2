/*
# Teacha Admin Panel — Security, Events, Research Notes, Beta Versions

## Summary

This migration adds the database infrastructure needed for a secure, functional admin panel for Teacha's Second Beta:

1. Adds an explicit `beta_version` column to `tester_profiles` (separate from the existing `group_assignment`).
2. Creates a lightweight `event_log` table for non-blocking behavioural event tracking.
3. Creates a `technical_errors` table for durable error recording.
4. Creates a `research_notes` table for the founder's research observations.
5. Creates an `admin_config` table storing a bcrypt hash of the admin password, with SECURITY DEFINER helper functions for verification.
6. Locks down `api_usage` so anon can no longer DELETE from it.
7. Sets up RLS and grants for all new tables.

## Security Model
- Student app uses the `anon` role (no Supabase Auth). Anon keeps INSERT/SELECT/UPDATE on existing tables. DELETE is preserved on student-facing tables (materials, sessions, messages, etc.) so the existing library delete flow continues to work.
- DELETE is revoked from anon on `api_usage` (students should never delete usage data).
- New tables (`event_log`, `technical_errors`) allow anon INSERT only (fire-and-forget from student app). No anon SELECT or DELETE.
- `research_notes` and `admin_config` are admin-only: no anon access at all.
- Admin access goes through server functions using `supabaseAdmin` (service role key), which bypasses RLS entirely.
- The admin password is stored as a bcrypt hash in `admin_config`, verified server-side via `verify_admin_password()`.

## Beta Version
- `beta_version` is nullable text with CHECK constraint: 'version_1', 'version_2', or NULL.
- Existing testers keep NULL until the founder explicitly assigns versions.
- Separate from `group_assignment` (A/B), which is preserved unchanged.

## Tables Created
1. `event_log` — behavioural events
2. `technical_errors` — durable error records
3. `research_notes` — founder's research observations
4. `admin_config` — admin password hash (single row)

## Tables Modified
1. `tester_profiles` — added `beta_version` column

## Functions Created
1. `verify_admin_password(input_password text)` — checks password against bcrypt hash
2. `set_admin_password(input_password text)` — sets/updates the admin password hash
*/

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add beta_version to tester_profiles
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE tester_profiles
  ADD COLUMN IF NOT EXISTS beta_version text
  CHECK (beta_version IS NULL OR beta_version IN ('version_1', 'version_2'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Create event_log table
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_log (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  tester_code text,
  session_id uuid,
  material_id uuid,
  concept_id text,
  beta_version text,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON event_log TO anon, authenticated;
GRANT SELECT ON event_log TO authenticated;

DROP POLICY IF EXISTS "anon can insert events" ON event_log;
CREATE POLICY "anon can insert events"
  ON event_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can read events" ON event_log;
CREATE POLICY "authenticated can read events"
  ON event_log FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_event_log_tester_code ON event_log(tester_code);
CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_session_id ON event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(event_timestamp DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Create technical_errors table
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS technical_errors (
  error_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_category text NOT NULL,
  error_feature text NOT NULL,
  error_code text,
  user_facing_error text,
  tester_code text,
  session_id uuid,
  error_timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

ALTER TABLE technical_errors ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON technical_errors TO anon, authenticated;
GRANT SELECT ON technical_errors TO authenticated;

DROP POLICY IF EXISTS "anon can insert errors" ON technical_errors;
CREATE POLICY "anon can insert errors"
  ON technical_errors FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can read errors" ON technical_errors;
CREATE POLICY "authenticated can read errors"
  ON technical_errors FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tech_errors_tester_code ON technical_errors(tester_code);
CREATE INDEX IF NOT EXISTS idx_tech_errors_category ON technical_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_tech_errors_timestamp ON technical_errors(error_timestamp DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Create research_notes table
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_notes (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_code text,
  session_id uuid,
  feature text,
  observation text NOT NULL,
  student_explanation text,
  possible_interpretation text,
  evidence_needed text,
  product_implication text,
  confidence text CHECK (confidence IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'supported', 'contradicted', 'resolved')),
  note_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON research_notes TO authenticated;

DROP POLICY IF EXISTS "authenticated can manage research notes" ON research_notes;
CREATE POLICY "authenticated can manage research notes"
  ON research_notes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated can insert research notes" ON research_notes;
CREATE POLICY "authenticated can insert research notes"
  ON research_notes FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can update research notes" ON research_notes;
CREATE POLICY "authenticated can update research notes"
  ON research_notes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can delete research notes" ON research_notes;
CREATE POLICY "authenticated can delete research notes"
  ON research_notes FOR DELETE
  TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Create admin_config table and helper functions
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_config (
  id int PRIMARY KEY DEFAULT 1,
  admin_password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- No grants to anon or authenticated — only service_role can access (bypasses RLS)
-- Ensure single row exists
INSERT INTO admin_config (id, admin_password_hash)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

-- verify_admin_password: checks a plaintext password against the stored bcrypt hash
-- Uses extensions.crypt since pgcrypto is installed in the extensions schema
CREATE OR REPLACE FUNCTION verify_admin_password(input_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_config
    WHERE id = 1
      AND admin_password_hash = extensions.crypt(input_password, admin_password_hash)
  );
$$;

REVOKE EXECUTE ON FUNCTION verify_admin_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_admin_password(text) TO authenticated;

-- set_admin_password: stores a bcrypt hash of the given password
CREATE OR REPLACE FUNCTION set_admin_password(input_password text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  UPDATE admin_config
  SET admin_password_hash = extensions.crypt(input_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = 1;
$$;

REVOKE EXECUTE ON FUNCTION set_admin_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_admin_password(text) TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Lock down api_usage: revoke DELETE from anon
-- ──────────────────────────────────────────────────────────────────────────────

REVOKE DELETE ON api_usage FROM anon;

-- Replace the broad "anon can manage api_usage" policy with specific verb policies
DROP POLICY IF EXISTS "anon can manage api_usage" ON api_usage;
DROP POLICY IF EXISTS "anon can delete api_usage" ON api_usage;

DROP POLICY IF EXISTS "anon can read api_usage" ON api_usage;
CREATE POLICY "anon can read api_usage"
  ON api_usage FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon can insert api_usage" ON api_usage;
CREATE POLICY "anon can insert api_usage"
  ON api_usage FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon can update api_usage" ON api_usage;
CREATE POLICY "anon can update api_usage"
  ON api_usage FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
