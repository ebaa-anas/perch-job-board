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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          body: string | null
          created_at: string
          from_stage: string | null
          id: string
          kind: string
          to_stage: string | null
          visibility: string
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          body?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          kind: string
          to_stage?: string | null
          visibility?: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          body?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          kind?: string
          to_stage?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_pipeline: {
        Row: {
          application_id: string
          decided_at: string | null
          rating: number | null
          stage: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          decided_at?: string | null
          rating?: number | null
          stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          decided_at?: string | null
          rating?: number | null
          stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_pipeline_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_pipeline_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          custom_answers: Json
          cv_filename: string | null
          cv_path: string | null
          id: string
          job_id: string
          note: string | null
          seeker_id: string
          via: string
        }
        Insert: {
          created_at?: string
          custom_answers?: Json
          cv_filename?: string | null
          cv_path?: string | null
          id?: string
          job_id: string
          note?: string | null
          seeker_id: string
          via?: string
        }
        Update: {
          created_at?: string
          custom_answers?: Json
          cv_filename?: string | null
          cv_path?: string | null
          id?: string
          job_id?: string
          note?: string | null
          seeker_id?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          logo_color: string
          logo_path: string | null
          name: string
          owner_id: string | null
          slug: string
          suspended_at: string | null
          suspended_reason: string | null
          tagline: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          logo_color?: string
          logo_path?: string | null
          name: string
          owner_id?: string | null
          slug: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tagline?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          logo_color?: string
          logo_path?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tagline?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reports: {
        Row: {
          company_id: string
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          profile_id: string
          role: string
        }
        Insert: {
          company_id: string
          created_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_reviews: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_fit_scores: {
        Row: {
          created_at: string
          gaps: string[]
          input_hash: string
          job_id: string
          score: number
          seeker_id: string
          strengths: string[]
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gaps?: string[]
          input_hash: string
          job_id: string
          score: number
          seeker_id: string
          strengths?: string[]
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gaps?: string[]
          input_hash?: string
          job_id?: string
          score?: number
          seeker_id?: string
          strengths?: string[]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_fit_scores_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_fit_scores_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_application_questions: {
        Row: {
          created_at: string
          id: string
          knockout_answer: string | null
          job_id: string
          label: string
          options: string[]
          position: number
          required: boolean
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          knockout_answer?: string | null
          job_id: string
          label: string
          options?: string[]
          position?: number
          required?: boolean
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          knockout_answer?: string | null
          job_id?: string
          label?: string
          options?: string[]
          position?: number
          required?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_application_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_views: {
        Row: {
          day: string
          job_id: string
          views: number
        }
        Insert: {
          day?: string
          job_id: string
          views?: number
        }
        Update: {
          day?: string
          job_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          apply_url: string | null
          company_id: string
          created_at: string
          currency: string
          description: string
          experience: string
          id: string
          language: string
          location: string
          no_experience_required: boolean
          perks: string[]
          requirements: string[]
          responsibilities: string[]
          salary_max: number
          salary_min: number
          slug: string
          status: string
          tags: string[]
          title: string
          type: string
          updated_at: string
          visa_sponsorship: boolean
          work_mode: string
        }
        Insert: {
          apply_url?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description: string
          experience: string
          id?: string
          language?: string
          location: string
          no_experience_required?: boolean
          perks?: string[]
          requirements?: string[]
          responsibilities?: string[]
          salary_max: number
          salary_min: number
          slug: string
          status?: string
          tags?: string[]
          title: string
          type: string
          updated_at?: string
          visa_sponsorship?: boolean
          work_mode: string
        }
        Update: {
          apply_url?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string
          experience?: string
          id?: string
          language?: string
          location?: string
          no_experience_required?: boolean
          perks?: string[]
          requirements?: string[]
          responsibilities?: string[]
          salary_max?: number
          salary_min?: number
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          visa_sponsorship?: boolean
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          profile_id: string
          read_at: string | null
          title: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          profile_id: string
          read_at?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          profile_id?: string
          read_at?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
          identity: string
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: number
          identity: string
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: number
          identity?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          job_id: string
          seeker_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          seeker_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          seeker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          frequency: string
          id: string
          label: string
          last_run_at: string | null
          query: string
          seeker_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          label: string
          last_run_at?: string | null
          query?: string
          seeker_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          label?: string
          last_run_at?: string | null
          query?: string
          seeker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seeker_profiles: {
        Row: {
          bio: string | null
          cv_filename: string | null
          cv_path: string | null
          github_url: string | null
          headline: string | null
          linkedin_url: string | null
          location: string | null
          portfolio_url: string | null
          profile_id: string
          skills: string[]
          updated_at: string
        }
        Insert: {
          bio?: string | null
          cv_filename?: string | null
          cv_path?: string | null
          github_url?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          portfolio_url?: string | null
          profile_id: string
          skills?: string[]
          updated_at?: string
        }
        Update: {
          bio?: string | null
          cv_filename?: string | null
          cv_path?: string | null
          github_url?: string | null
          headline?: string | null
          linkedin_url?: string | null
          location?: string | null
          portfolio_url?: string | null
          profile_id?: string
          skills?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seeker_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_response_rates: {
        Row: {
          company_id: string | null
          responded_applications: number | null
          total_applications: number | null
        }
        Relationships: []
      }
      job_view_totals: {
        Row: {
          job_id: string | null
          views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_company_invite: { Args: { p_token: string }; Returns: string }
      company_suspended: { Args: { target: string }; Returns: boolean }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_identity: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      can_manage_company: { Args: { target: string }; Returns: boolean }
      current_user_role: { Args: never; Returns: string }
      has_company_seat: { Args: never; Returns: boolean }
      record_job_view: { Args: { p_job: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_company_member: { Args: { target: string }; Returns: boolean }
      is_application_applicant: { Args: { target_application: string }; Returns: boolean }
      owns_application: { Args: { target_application: string }; Returns: boolean }
      owns_company: { Args: { target: string }; Returns: boolean }
      owns_job: { Args: { target_job: string }; Returns: boolean }
      transfer_company_ownership: {
        Args: { p_company: string; p_to: string }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
