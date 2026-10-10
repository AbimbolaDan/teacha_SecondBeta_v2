export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          api_calls: number | null
          assessment_generation_calls: number | null
          concept_extraction_calls: number | null
          date: string
        }
        Insert: {
          api_calls?: number | null
          assessment_generation_calls?: number | null
          concept_extraction_calls?: number | null
          date: string
        }
        Update: {
          api_calls?: number | null
          assessment_generation_calls?: number | null
          concept_extraction_calls?: number | null
          date?: string
        }
        Relationships: []
      }
      concept_coverage: {
        Row: {
          concept_coverage_id: string
          concept_name: string
          material_id: string | null
          session_id: string | null
          session_timestamp: string
          tester_code: string | null
        }
        Insert: {
          concept_coverage_id?: string
          concept_name: string
          material_id?: string | null
          session_id?: string | null
          session_timestamp?: string
          tester_code?: string | null
        }
        Update: {
          concept_coverage_id?: string
          concept_name?: string
          material_id?: string | null
          session_id?: string | null
          session_timestamp?: string
          tester_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_coverage_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "concept_coverage_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "concept_coverage_tester_code_fkey"
            columns: ["tester_code"]
            isOneToOne: false
            referencedRelation: "tester_profiles"
            referencedColumns: ["tester_code"]
          },
        ]
      }
      mastery_events: {
        Row: {
          assessment_question: string | null
          concept_name: string
          event_timestamp: string
          event_type: string
          feedback_result: string | null
          mastery_event_id: string
          session_id: string | null
          student_answer: string | null
          tester_code: string | null
          wunmi_evaluation: string | null
        }
        Insert: {
          assessment_question?: string | null
          concept_name: string
          event_timestamp?: string
          event_type: string
          feedback_result?: string | null
          mastery_event_id?: string
          session_id?: string | null
          student_answer?: string | null
          tester_code?: string | null
          wunmi_evaluation?: string | null
        }
        Update: {
          assessment_question?: string | null
          concept_name?: string
          event_timestamp?: string
          event_type?: string
          feedback_result?: string | null
          mastery_event_id?: string
          session_id?: string | null
          student_answer?: string | null
          tester_code?: string | null
          wunmi_evaluation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mastery_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "mastery_events_tester_code_fkey"
            columns: ["tester_code"]
            isOneToOne: false
            referencedRelation: "tester_profiles"
            referencedColumns: ["tester_code"]
          },
        ]
      }
      materials: {
        Row: {
          content_text: string | null
          created_at: string
          last_used_at: string | null
          material_id: string
          material_name: string
          page_count: number | null
          tester_code: string | null
          upload_type: string | null
          word_count: number | null
        }
        Insert: {
          content_text?: string | null
          created_at?: string
          last_used_at?: string | null
          material_id?: string
          material_name?: string
          page_count?: number | null
          tester_code?: string | null
          upload_type?: string | null
          word_count?: number | null
        }
        Update: {
          content_text?: string | null
          created_at?: string
          last_used_at?: string | null
          material_id?: string
          material_name?: string
          page_count?: number | null
          tester_code?: string | null
          upload_type?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_tester_code_fkey"
            columns: ["tester_code"]
            isOneToOne: false
            referencedRelation: "tester_profiles"
            referencedColumns: ["tester_code"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          feedback_tag: string | null
          is_student_initiated: boolean | null
          message_id: string
          message_type: string | null
          page_reference: number | null
          predict_concept: string | null
          role: string | null
          seconds_since_previous: number | null
          session_id: string | null
          timestamp: string
          verify_flag: string | null
        }
        Insert: {
          content: string
          feedback_tag?: string | null
          is_student_initiated?: boolean | null
          message_id?: string
          message_type?: string | null
          page_reference?: number | null
          predict_concept?: string | null
          role?: string | null
          seconds_since_previous?: number | null
          session_id?: string | null
          timestamp?: string
          verify_flag?: string | null
        }
        Update: {
          content?: string
          feedback_tag?: string | null
          is_student_initiated?: boolean | null
          message_id?: string
          message_type?: string | null
          page_reference?: number | null
          predict_concept?: string | null
          role?: string | null
          seconds_since_previous?: number | null
          session_id?: string | null
          timestamp?: string
          verify_flag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      misconception_events: {
        Row: {
          event_timestamp: string
          misconception_concept: string
          misconception_event_id: string
          session_id: string | null
          tester_code: string | null
          wunmi_correction: string
        }
        Insert: {
          event_timestamp?: string
          misconception_concept: string
          misconception_event_id?: string
          session_id?: string | null
          tester_code?: string | null
          wunmi_correction: string
        }
        Update: {
          event_timestamp?: string
          misconception_concept?: string
          misconception_event_id?: string
          session_id?: string | null
          tester_code?: string | null
          wunmi_correction?: string
        }
        Relationships: [
          {
            foreignKeyName: "misconception_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "misconception_events_tester_code_fkey"
            columns: ["tester_code"]
            isOneToOne: false
            referencedRelation: "tester_profiles"
            referencedColumns: ["tester_code"]
          },
        ]
      }
      sessions: {
        Row: {
          confidence_rating: string | null
          duration_seconds: number | null
          ended_at: string | null
          material_id: string | null
          message_count: number | null
          session_id: string
          session_mode: string | null
          started_at: string
          status: string | null
          tester_code: string | null
        }
        Insert: {
          confidence_rating?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          material_id?: string | null
          message_count?: number | null
          session_id?: string
          session_mode?: string | null
          started_at?: string
          status?: string | null
          tester_code?: string | null
        }
        Update: {
          confidence_rating?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          material_id?: string | null
          message_count?: number | null
          session_id?: string
          session_mode?: string | null
          started_at?: string
          status?: string | null
          tester_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "sessions_tester_code_fkey"
            columns: ["tester_code"]
            isOneToOne: false
            referencedRelation: "tester_profiles"
            referencedColumns: ["tester_code"]
          },
        ]
      }
      tester_profiles: {
        Row: {
          course: string
          created_at: string
          group_assignment: string | null
          institution: string | null
          is_active: boolean
          name: string
          tester_code: string
          year_level: string
        }
        Insert: {
          course: string
          created_at?: string
          group_assignment?: string | null
          institution?: string | null
          is_active?: boolean
          name: string
          tester_code: string
          year_level: string
        }
        Update: {
          course?: string
          created_at?: string
          group_assignment?: string | null
          institution?: string | null
          is_active?: boolean
          name?: string
          tester_code?: string
          year_level?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tester_code: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
