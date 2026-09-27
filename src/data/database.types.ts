export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      cards: {
        Row: {
          created_at: string
          deleted_at: string | null
          entry_id: string | null
          episode_log_id: string | null
          id: string
          image_path: string | null
          kind: string
          params: Json
          reading_log_id: string | null
          shared_at: string | null
          size: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entry_id?: string | null
          episode_log_id?: string | null
          id: string
          image_path?: string | null
          kind: string
          params?: Json
          reading_log_id?: string | null
          shared_at?: string | null
          size: string
          template_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entry_id?: string | null
          episode_log_id?: string | null
          id?: string
          image_path?: string | null
          kind?: string
          params?: Json
          reading_log_id?: string | null
          shared_at?: string | null
          size?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_entry_id_user_id_fkey"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cards_episode_log_id_user_id_fkey"
            columns: ["episode_log_id", "user_id"]
            isOneToOne: false
            referencedRelation: "episode_logs"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cards_reading_log_id_user_id_fkey"
            columns: ["reading_log_id", "user_id"]
            isOneToOne: false
            referencedRelation: "reading_logs"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          finished_at: string | null
          id: string
          rating: number | null
          review: string | null
          status: string
          title_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id: string
          rating?: number | null
          review?: string | null
          status: string
          title_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          rating?: number | null
          review?: string | null
          status?: string
          title_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_logs: {
        Row: {
          created_at: string
          deleted_at: string | null
          episode: number
          id: string
          runtime_min: number | null
          season: number
          title_id: string
          updated_at: string
          user_id: string
          watched_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          episode: number
          id: string
          runtime_min?: number | null
          season: number
          title_id: string
          updated_at?: string
          user_id?: string
          watched_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          episode?: number
          id?: string
          runtime_min?: number | null
          season?: number
          title_id?: string
          updated_at?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_logs_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email_recaps: boolean
          id: string
          locale: string
          theme: string
          time_zone: string
          updated_at: string
          username: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_recaps?: boolean
          id: string
          locale?: string
          theme?: string
          time_zone?: string
          updated_at?: string
          username: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_recaps?: boolean
          id?: string
          locale?: string
          theme?: string
          time_zone?: string
          updated_at?: string
          username?: string
          visibility?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reading_logs: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          position: number
          read_at: string
          title_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          position: number
          read_at?: string
          title_id: string
          unit: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          position?: number
          read_at?: string
          title_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_logs_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reason: string
          reporter_id: string | null
          resolved_at: string | null
          target_id: string
          target_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          note?: string | null
          reason: string
          reporter_id?: string | null
          resolved_at?: string | null
          target_id: string
          target_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reason?: string
          reporter_id?: string | null
          resolved_at?: string | null
          target_id?: string
          target_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_episodes: {
        Row: {
          air_date: string | null
          created_at: string
          episode: number
          fetched_at: string
          name: string | null
          runtime_min: number | null
          season: number
          title_id: string
          updated_at: string
        }
        Insert: {
          air_date?: string | null
          created_at?: string
          episode: number
          fetched_at?: string
          name?: string | null
          runtime_min?: number | null
          season: number
          title_id: string
          updated_at?: string
        }
        Update: {
          air_date?: string | null
          created_at?: string
          episode?: number
          fetched_at?: string
          name?: string | null
          runtime_min?: number | null
          season?: number
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_episodes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          chapter_count: number | null
          created_at: string
          episode_count: number | null
          external_id: string
          fetched_at: string
          genres: string[]
          id: string
          kind: string
          name: string
          original_language: string | null
          original_name: string | null
          page_count: number | null
          palette: Json | null
          poster_path: string | null
          raw: Json | null
          runtime_min: number | null
          season_count: number | null
          source: string
          updated_at: string
          volume_count: number | null
          year: number | null
        }
        Insert: {
          chapter_count?: number | null
          created_at?: string
          episode_count?: number | null
          external_id: string
          fetched_at?: string
          genres?: string[]
          id?: string
          kind: string
          name: string
          original_language?: string | null
          original_name?: string | null
          page_count?: number | null
          palette?: Json | null
          poster_path?: string | null
          raw?: Json | null
          runtime_min?: number | null
          season_count?: number | null
          source: string
          updated_at?: string
          volume_count?: number | null
          year?: number | null
        }
        Update: {
          chapter_count?: number | null
          created_at?: string
          episode_count?: number | null
          external_id?: string
          fetched_at?: string
          genres?: string[]
          id?: string
          kind?: string
          name?: string
          original_language?: string | null
          original_name?: string | null
          page_count?: number | null
          palette?: Json | null
          poster_path?: string | null
          raw?: Json | null
          runtime_min?: number | null
          season_count?: number | null
          source?: string
          updated_at?: string
          volume_count?: number | null
          year?: number | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          consent_at: string
          created_at: string
          email: string
          id: string
          launch_sent_at: string | null
          locale: string
          source: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          consent_at: string
          created_at?: string
          email: string
          id?: string
          launch_sent_at?: string | null
          locale?: string
          source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_at?: string
          created_at?: string
          email?: string
          id?: string
          launch_sent_at?: string | null
          locale?: string
          source?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      weekly_recaps: {
        Row: {
          card_id: string | null
          created_at: string
          id: string
          notified_at: string | null
          pushed_at: string | null
          stats: Json
          user_id: string
          week_start: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          id: string
          notified_at?: string | null
          pushed_at?: string | null
          stats: Json
          user_id: string
          week_start: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          id?: string
          notified_at?: string | null
          pushed_at?: string | null
          stats?: Json
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_recaps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_recaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_reserved_username: { Args: { name: string }; Returns: boolean }
      is_time_zone: { Args: { tz: string }; Returns: boolean }
      public_profile: {
        Args: { p_username: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          id: string
          is_private: boolean
          username: string
        }[]
      }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      rate_limits_prune: { Args: never; Returns: undefined }
      shared_card: {
        Args: { p_id: string }
        Returns: {
          id: string
          image_path: string
          kind: string
          params: Json
          profile_username: string
          shared_at: string
          size: string
          template_id: string
        }[]
      }
      suggest_username: { Args: { seed: string }; Returns: string }
      weekly_recap_candidates: {
        Args: { p_limit: number; p_now: string }
        Returns: {
          time_zone: string
          user_id: string
          week_start: string
        }[]
      }
      weekly_recaps_to_notify: {
        Args: { p_limit: number }
        Returns: {
          email: string
          id: string
          locale: string
          stats: Json
          user_id: string
          week_start: string
        }[]
      }
      weekly_recaps_to_push: {
        Args: { p_limit: number }
        Returns: {
          auth: string
          endpoint: string
          id: string
          locale: string
          p256dh: string
          stats: Json
          subscription_id: string
          user_id: string
        }[]
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

