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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
          deleted_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      challenge_joins: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          month: string
          progress: number
          slug: string
          title_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          month: string
          progress?: number
          slug: string
          title_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          month?: string
          progress?: number
          slug?: string
          title_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_joins_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_joins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club: string
          created_at?: string
          deleted_at?: string | null
          id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          club?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reels: {
        Row: {
          created_at: string
          day: string
          number: number
          title_id: string
        }
        Insert: {
          created_at?: string
          day: string
          number: number
          title_id: string
        }
        Update: {
          created_at?: string
          day?: string
          number?: number
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reels_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          edited_at: string
          finish_members: number | null
          finish_share: number | null
          finished_at: string | null
          finisher_no: number | null
          hours_played: number | null
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
          edited_at?: string
          finish_members?: number | null
          finish_share?: number | null
          finished_at?: string | null
          finisher_no?: number | null
          hours_played?: number | null
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
          edited_at?: string
          finish_members?: number | null
          finish_share?: number | null
          finished_at?: string | null
          finisher_no?: number | null
          hours_played?: number | null
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
      feedback: {
        Row: {
          created_at: string
          device: string | null
          error_ref: string | null
          id: string
          kind: string
          locale: string
          message: string
          page: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          error_ref?: string | null
          id: string
          kind: string
          locale?: string
          message: string
          page?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          error_ref?: string | null
          id?: string
          kind?: string
          locale?: string
          message?: string
          page?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          deleted_at: string | null
          followee_id: string
          follower_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          followee_id: string
          follower_id?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          followee_id?: string
          follower_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_marks: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          kind: string
          slug: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_marks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_posts: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          description: string | null
          excerpt: string | null
          feature_request: string | null
          featured_at: string | null
          hidden_at: string | null
          id: string
          locale: string
          minutes: number
          published_at: string | null
          review_note: string | null
          spoilers: boolean
          subjects: string[]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          excerpt?: string | null
          feature_request?: string | null
          featured_at?: string | null
          hidden_at?: string | null
          id: string
          locale: string
          minutes?: number
          published_at?: string | null
          review_note?: string | null
          spoilers?: boolean
          subjects?: string[]
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          excerpt?: string | null
          feature_request?: string | null
          featured_at?: string | null
          hidden_at?: string | null
          id?: string
          locale?: string
          minutes?: number
          published_at?: string | null
          review_note?: string | null
          spoilers?: boolean
          subjects?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_regions: {
        Row: {
          country: string
          created_at: string
          deleted_at: string | null
          id: string
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          deleted_at?: string | null
          id: string
          region: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_regions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          country: string
          created_at: string
          deleted_at: string | null
          first_year: number | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          deleted_at?: string | null
          first_year?: number | null
          id: string
          status: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          country?: string
          created_at?: string
          deleted_at?: string | null
          first_year?: number | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          album_hidden: string[]
          album_order: string[]
          atlas_public: boolean
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email_recaps: boolean
          id: string
          locale: string
          milestones_seen: Json
          reel_reminded_on: string | null
          reel_reminders: boolean
          shelf_pins: string[]
          stats_hidden: string[]
          theme: string
          time_zone: string
          updated_at: string
          username: string
          visibility: string
        }
        Insert: {
          album_hidden?: string[]
          album_order?: string[]
          atlas_public?: boolean
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_recaps?: boolean
          id: string
          locale?: string
          milestones_seen?: Json
          reel_reminded_on?: string | null
          reel_reminders?: boolean
          shelf_pins?: string[]
          stats_hidden?: string[]
          theme?: string
          time_zone?: string
          updated_at?: string
          username: string
          visibility?: string
        }
        Update: {
          album_hidden?: string[]
          album_order?: string[]
          atlas_public?: boolean
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_recaps?: boolean
          id?: string
          locale?: string
          milestones_seen?: Json
          reel_reminded_on?: string | null
          reel_reminders?: boolean
          shelf_pins?: string[]
          stats_hidden?: string[]
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
      quiz_answers: {
        Row: {
          answered_at: string | null
          choice: string | null
          counted: boolean
          id: string
          question_id: string | null
          served_at: string
          too_fast: boolean
          user_id: string
          warning_id: string | null
        }
        Insert: {
          answered_at?: string | null
          choice?: string | null
          counted?: boolean
          id?: string
          question_id?: string | null
          served_at?: string
          too_fast?: boolean
          user_id: string
          warning_id?: string | null
        }
        Update: {
          answered_at?: string | null
          choice?: string | null
          counted?: boolean
          id?: string
          question_id?: string | null
          served_at?: string
          too_fast?: boolean
          user_id?: string
          warning_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "scene_warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_pauses: {
        Row: {
          created_at: string
          paused_until: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          paused_until: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          paused_until?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_pauses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          no_count: number
          resolved_at: string | null
          status: string
          title_id: string
          topic: string
          updated_at: string
          yes_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          no_count?: number
          resolved_at?: string | null
          status?: string
          title_id: string
          topic: string
          updated_at?: string
          yes_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          no_count?: number
          resolved_at?: string | null
          status?: string
          title_id?: string
          topic?: string
          updated_at?: string
          yes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_topic_fkey"
            columns: ["topic"]
            isOneToOne: false
            referencedRelation: "warning_topics"
            referencedColumns: ["slug"]
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
      reel_plays: {
        Row: {
          created_at: string
          day: string
          finished_at: string | null
          guesses: Json
          id: string
          solved: boolean
          streak: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          finished_at?: string | null
          guesses?: Json
          id: string
          solved?: boolean
          streak?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          finished_at?: string | null
          guesses?: Json
          id?: string
          solved?: boolean
          streak?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_plays_day_fkey"
            columns: ["day"]
            isOneToOne: false
            referencedRelation: "daily_reels"
            referencedColumns: ["day"]
          },
          {
            foreignKeyName: "reel_plays_user_id_fkey"
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
      scene_warning_votes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
          user_id: string
          vote: number
          warning_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          updated_at?: string
          user_id?: string
          vote: number
          warning_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          vote?: number
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scene_warning_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_warning_votes_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "scene_warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_warnings: {
        Row: {
          confirms: number
          created_at: string
          deleted_at: string | null
          disputes: number
          end_sec: number | null
          episode: number | null
          id: string
          position: number | null
          season: number | null
          start_sec: number | null
          status: string
          title_id: string
          topic: string
          unit: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirms?: number
          created_at?: string
          deleted_at?: string | null
          disputes?: number
          end_sec?: number | null
          episode?: number | null
          id: string
          position?: number | null
          season?: number | null
          start_sec?: number | null
          status?: string
          title_id: string
          topic: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirms?: number
          created_at?: string
          deleted_at?: string | null
          disputes?: number
          end_sec?: number | null
          episode?: number | null
          id?: string
          position?: number | null
          season?: number | null
          start_sec?: number | null
          status?: string
          title_id?: string
          topic?: string
          unit?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_warnings_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_warnings_topic_fkey"
            columns: ["topic"]
            isOneToOne: false
            referencedRelation: "warning_topics"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "scene_warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          created_at: string
          deleted_at: string | null
          entry_id: string
          id: string
          owner_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entry_id: string
          id: string
          owner_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entry_id?: string
          id?: string
          owner_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamps_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          event_at: string
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          event_at: string
          price_id?: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          event_at?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
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
      title_finish_counts: {
        Row: {
          finishers: number
          title_id: string
          updated_at: string
        }
        Insert: {
          finishers?: number
          title_id: string
          updated_at?: string
        }
        Update: {
          finishers?: number
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_finish_counts_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: true
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_finishers: {
        Row: {
          created_at: string
          members: number | null
          number: number
          share: number | null
          title_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          members?: number | null
          number: number
          share?: number | null
          title_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          members?: number | null
          number?: number
          share?: number | null
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_finishers_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "title_finishers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_providers: {
        Row: {
          fetched_at: string
          providers: Json
          title_id: string
        }
        Insert: {
          fetched_at?: string
          providers: Json
          title_id: string
        }
        Update: {
          fetched_at?: string
          providers?: Json
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_providers_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: true
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      title_warnings: {
        Row: {
          category: string
          comment: string | null
          fetched_at: string
          no_count: number
          spoiler: boolean
          title_id: string
          topic_id: number
          topic_name: string
          yes_count: number
        }
        Insert: {
          category: string
          comment?: string | null
          fetched_at?: string
          no_count: number
          spoiler?: boolean
          title_id: string
          topic_id: number
          topic_name: string
          yes_count: number
        }
        Update: {
          category?: string
          comment?: string | null
          fetched_at?: string
          no_count?: number
          spoiler?: boolean
          title_id?: string
          topic_id?: number
          topic_name?: string
          yes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "title_warnings_title_id_fkey"
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
          credits: Json | null
          dtdd_checked_at: string | null
          dtdd_id: number | null
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
          platforms: string[]
          playtime_hours: number | null
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
          credits?: Json | null
          dtdd_checked_at?: string | null
          dtdd_id?: number | null
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
          platforms?: string[]
          playtime_hours?: number | null
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
          credits?: Json | null
          dtdd_checked_at?: string | null
          dtdd_id?: number | null
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
          platforms?: string[]
          playtime_hours?: number | null
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
      user_avoid_topics: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          topic_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          topic_id: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          topic_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avoid_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge: string
          created_at: string
          earned_at: string
          id: string
          title_id: string | null
          user_id: string
        }
        Insert: {
          badge: string
          created_at?: string
          earned_at: string
          id: string
          title_id?: string | null
          user_id: string
        }
        Update: {
          badge?: string
          created_at?: string
          earned_at?: string
          id?: string
          title_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      warning_topics: {
        Row: {
          active: boolean
          created_at: string
          dtdd_id: number
          kinds: string[]
          quiz: boolean
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dtdd_id: number
          kinds: string[]
          quiz?: boolean
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dtdd_id?: number
          kinds?: string[]
          quiz?: boolean
          slug?: string
        }
        Relationships: []
      }
      weekly_recaps: {
        Row: {
          card_id: string | null
          created_at: string
          id: string
          notified_at: string | null
          period: string
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
          period?: string
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
          period?: string
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
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      avoid_warnings: {
        Args: { p_title_ids: string[] }
        Returns: {
          no_count: number
          title_id: string
          topic_id: number
          topic_name: string
          yes_count: number
        }[]
      }
      award_supporter: {
        Args: { p_at: string; p_email: string }
        Returns: boolean
      }
      challenge_counts: {
        Args: { p_month: string }
        Returns: {
          completed: number
          joined: number
          slug: string
        }[]
      }
      club_counts: {
        Args: never
        Returns: {
          club: string
          members: number
        }[]
      }
      club_feed: {
        Args: {
          p_club: string
          p_genres?: string[]
          p_kinds?: string[]
          p_languages?: string[]
          p_limit?: number
        }
        Returns: {
          avatar_url: string
          card_id: string
          card_image_path: string
          display_name: string
          entry_id: string
          finish_members: number
          finish_share: number
          finished_at: string
          poster_path: string
          rating: number
          review: string
          stamp_count: number
          stamped: boolean
          title_external_id: string
          title_id: string
          title_kind: string
          title_name: string
          title_source: string
          title_year: number
          user_id: string
          username: string
        }[]
      }
      club_trending: {
        Args: {
          p_club: string
          p_days?: number
          p_genres?: string[]
          p_kinds?: string[]
          p_languages?: string[]
          p_limit?: number
        }
        Returns: {
          external_id: string
          kind: string
          name: string
          people: number
          poster_path: string
          source: string
          title_id: string
          year: number
        }[]
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      community_avoid_hits: {
        Args: { p_title_ids: string[] }
        Returns: {
          title_id: string
          topic: string
          topic_id: number
        }[]
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      follow_counts: {
        Args: { p_user_id: string }
        Returns: {
          followers: number
          following: number
          i_follow: boolean
        }[]
      }
      following_feed: {
        Args: { p_before?: string; p_before_id?: string; p_limit?: number }
        Returns: {
          avatar_url: string
          card_id: string
          card_image_path: string
          display_name: string
          entry_id: string
          finish_members: number
          finish_share: number
          finished_at: string
          poster_path: string
          rating: number
          review: string
          stamp_count: number
          stamped: boolean
          title_external_id: string
          title_id: string
          title_kind: string
          title_name: string
          title_source: string
          title_year: number
          user_id: string
          username: string
        }[]
      }
      format_type_string: { Args: { "": string }; Returns: string }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      is_reserved_username: { Args: { name: string }; Returns: boolean }
      is_time_zone: { Args: { tz: string }; Returns: boolean }
      isnt_empty: { Args: { "": string }; Returns: string }
      journal_bylines: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      journal_stamp_counts: {
        Args: never
        Returns: {
          slug: string
          stamps: number
        }[]
      }
      lives_ok: { Args: { "": string }; Returns: string }
      member_count: { Args: never; Returns: number }
      monthly_recap_candidates: {
        Args: { p_limit: number; p_now: string }
        Returns: {
          month_start: string
          time_zone: string
          user_id: string
        }[]
      }
      my_activity: {
        Args: { p_limit?: number }
        Returns: {
          at: string
          avatar_url: string
          display_name: string
          entry_id: string
          i_follow: boolean
          kind: string
          title_name: string
          user_id: string
          username: string
        }[]
      }
      my_blocks: {
        Args: never
        Returns: {
          blocked_at: string
          id: string
          username: string
        }[]
      }
      my_following: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          followed_at: string
          id: string
          username: string
        }[]
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      public_profile: {
        Args: { p_username: string }
        Returns: {
          album_hidden: string[]
          album_order: string[]
          avatar_url: string
          bio: string
          blocked_by_me: boolean
          created_at: string
          display_name: string
          id: string
          is_private: boolean
          shelf_pins: string[]
          stats_hidden: string[]
          username: string
        }[]
      }
      quiz_answer: { Args: { p_choice: string; p_id: string }; Returns: Json }
      quiz_next: {
        Args: { p_title_id?: string; p_topics?: string[] }
        Returns: Json
      }
      rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      rate_limits_prune: { Args: never; Returns: undefined }
      reel_reminders_due: {
        Args: { p_day: string; p_limit: number }
        Returns: {
          auth: string
          endpoint: string
          locale: string
          p256dh: string
          streak: number
          subscription_id: string
          time_zone: string
          user_id: string
        }[]
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      scene_warning_tally: {
        Args: { p_warning_id: string }
        Returns: {
          confirms: number
          disputes: number
          my_vote: number
          status: string
        }[]
      }
      search_people: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          display_name: string
          finished: number
          i_follow: boolean
          id: string
          username: string
        }[]
      }
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
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      suggest_username: { Args: { seed: string }; Returns: string }
      suggested_people: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          club: string
          country: string
          display_name: string
          finished: number
          id: string
          mutuals: number
          shared: number
          shared_title: string
          username: string
        }[]
      }
      throws_ok: { Args: { "": string }; Returns: string }
      title_reviews: {
        Args: { p_limit?: number; p_title_id: string }
        Returns: {
          avatar_url: string
          card_id: string
          card_image_path: string
          display_name: string
          entry_id: string
          finish_members: number
          finish_share: number
          finished_at: string
          poster_path: string
          rating: number
          review: string
          stamp_count: number
          stamped: boolean
          title_external_id: string
          title_id: string
          title_kind: string
          title_name: string
          title_source: string
          title_year: number
          user_id: string
          username: string
        }[]
      }
      title_scene_warnings: {
        Args: { p_title_id: string }
        Returns: {
          confirms: number
          created_at: string
          disputes: number
          end_sec: number
          episode: number
          id: string
          mine: boolean
          my_vote: number
          position: number
          season: number
          start_sec: number
          status: string
          topic: string
          unit: string
        }[]
      }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      trending_titles: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          external_id: string
          finishers: number
          kind: string
          name: string
          people: number
          poster_path: string
          source: string
          title_id: string
          year: number
        }[]
      }
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
      _time_trial_type: {
        a_time: number | null
      }
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

