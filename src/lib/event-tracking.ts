import { supabase } from "@/integrations/supabase/client";

export type EventType =
  | "session_started"
  | "session_message_sent"
  | "session_completed"
  | "session_resumed"
  | "library_opened"
  | "material_selected"
  | "material_used"
  | "assessment_started"
  | "assessment_skipped"
  | "assessment_completed"
  | "assessment_failed"
  | "coverage_map_opened"
  | "coverage_topic_selected"
  | "topic_viewed"
  | "session_started_from_topic"
  | "topic_resumed"
  | "technical_error";

export interface EventPayload {
  eventType: EventType;
  testerCode?: string | null;
  sessionId?: string | null;
  materialId?: string | null;
  conceptId?: string | null;
  betaVersion?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Non-blocking event logger. Fire-and-forget — never throws or blocks student flow.
 * Uses the anon-key client, which has INSERT-only access to event_log.
 */
export function logEvent(payload: EventPayload): void {
  const testerCode = payload.testerCode ?? localStorage.getItem("teacha_tester_code");
  void supabase
    .from("event_log")
    .insert({
      event_type: payload.eventType,
      tester_code: testerCode ?? null,
      session_id: payload.sessionId ?? null,
      material_id: payload.materialId ?? null,
      concept_id: payload.conceptId ?? null,
      beta_version: payload.betaVersion ?? null,
      metadata: payload.metadata ?? null,
    })
    .then(() => {})
    .catch((e) => console.error("Event log failed (non-blocking):", e));
}

/**
 * Non-blocking error logger. Fire-and-forget — never throws or blocks student flow.
 */
export function logError(payload: {
  category: string;
  feature: string;
  errorCode?: string;
  userFacingError?: string;
  testerCode?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  const testerCode = payload.testerCode ?? localStorage.getItem("teacha_tester_code");
  void supabase
    .from("technical_errors")
    .insert({
      error_category: payload.category,
      error_feature: payload.feature,
      error_code: payload.errorCode ?? null,
      user_facing_error: payload.userFacingError ?? null,
      tester_code: testerCode ?? null,
      session_id: payload.sessionId ?? null,
      metadata: payload.metadata ?? null,
    })
    .then(() => {})
    .catch((e) => console.error("Error log failed (non-blocking):", e));
}
