CREATE OR REPLACE FUNCTION public.current_tester_code() RETURNS TEXT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'tester_code', '')
$$;

CREATE TABLE public.tester_profiles (
  tester_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level TEXT NOT NULL,
  institution TEXT,
  group_assignment TEXT CHECK (group_assignment IN ('A','B')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.materials (
  material_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_code TEXT REFERENCES public.tester_profiles(tester_code) ON DELETE CASCADE,
  material_name TEXT NOT NULL DEFAULT 'Untitled Material',
  content_text TEXT,
  page_count INTEGER DEFAULT 0,
  upload_type TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE TABLE public.sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tester_code TEXT REFERENCES public.tester_profiles(tester_code) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(material_id) ON DELETE SET NULL,
  session_mode TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  confidence_rating TEXT
);
CREATE TABLE public.messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  role TEXT,
  content TEXT NOT NULL,
  feedback_tag TEXT,
  verify_flag TEXT,
  predict_concept TEXT,
  page_reference INTEGER,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_student_initiated BOOLEAN DEFAULT false,
  seconds_since_previous INTEGER,
  message_type TEXT DEFAULT 'response'
);
CREATE TABLE public.concept_coverage (
  concept_coverage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  tester_code TEXT REFERENCES public.tester_profiles(tester_code) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(material_id) ON DELETE SET NULL,
  concept_name TEXT NOT NULL,
  session_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.mastery_events (
  mastery_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  tester_code TEXT REFERENCES public.tester_profiles(tester_code) ON DELETE CASCADE,
  concept_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  feedback_result TEXT,
  assessment_question TEXT,
  student_answer TEXT,
  wunmi_evaluation TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.misconception_events (
  misconception_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(session_id) ON DELETE CASCADE,
  tester_code TEXT REFERENCES public.tester_profiles(tester_code) ON DELETE CASCADE,
  misconception_concept TEXT NOT NULL,
  wunmi_correction TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.api_usage (
  date DATE PRIMARY KEY,
  api_calls INTEGER DEFAULT 0,
  concept_extraction_calls INTEGER DEFAULT 0,
  assessment_generation_calls INTEGER DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tester_profiles, public.materials, public.sessions, public.messages, public.concept_coverage, public.mastery_events, public.misconception_events TO authenticated;
GRANT ALL ON public.tester_profiles, public.materials, public.sessions, public.messages, public.concept_coverage, public.mastery_events, public.misconception_events, public.api_usage TO service_role;

ALTER TABLE public.tester_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misconception_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tester owns profile" ON public.tester_profiles FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
CREATE POLICY "Tester owns materials" ON public.materials FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
CREATE POLICY "Tester owns sessions" ON public.sessions FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
CREATE POLICY "Tester owns messages" ON public.messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.session_id = messages.session_id AND s.tester_code = public.current_tester_code()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.session_id = messages.session_id AND s.tester_code = public.current_tester_code()));
CREATE POLICY "Tester owns concept coverage" ON public.concept_coverage FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
CREATE POLICY "Tester owns mastery events" ON public.mastery_events FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
CREATE POLICY "Tester owns misconception events" ON public.misconception_events FOR ALL TO authenticated USING (tester_code = public.current_tester_code()) WITH CHECK (tester_code = public.current_tester_code());
-- api_usage: no tester policies; only the service role (admin panel) can access it. service_role bypasses RLS on all tables.
