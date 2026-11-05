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
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          stars_reset_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
          stars_reset_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          stars_reset_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_requests: {
        Row: {
          created_at: string
          created_by: string
          day: string
          family_id: string
          id: string
          part: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          day: string
          family_id: string
          id?: string
          part?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day?: string
          family_id?: string
          id?: string
          part?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_tasks: {
        Row: {
          created_at: string
          family_id: string
          id: string
          interval_days: number
          last_done: string
          next_due: string
          title: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          interval_days?: number
          last_done: string
          next_due: string
          title: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          interval_days?: number
          last_done?: string
          next_due?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          created_at: string
          family_id: string
          id: string
          redeemed_by: string
          reward_name: string
          stars: number
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          redeemed_by?: string
          reward_name: string
          stars: number
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          redeemed_by?: string
          reward_name?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          family_id: string
          id: string
          name: string
          stars_required: number
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          name: string
          stars_required: number
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          stars_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "rewards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          created_at: string
          end_time: string | null
          family_id: string
          id: string
          kind: string
          on_date: string | null
          start_time: string
          title: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          family_id: string
          id?: string
          kind?: string
          on_date?: string | null
          start_time: string
          title: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          family_id?: string
          id?: string
          kind?: string
          on_date?: string | null
          start_time?: string
          title?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_by: string
          created_at: string
          day: string
          family_id: string
          id: string
          self_done: boolean
          stars: number
          task_key: string
        }
        Insert: {
          completed_by?: string
          created_at?: string
          day: string
          family_id: string
          id?: string
          self_done?: boolean
          stars?: number
          task_key: string
        }
        Update: {
          completed_by?: string
          created_at?: string
          day?: string
          family_id?: string
          id?: string
          self_done?: boolean
          stars?: number
          task_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      water_checks: {
        Row: { answered_at: string; answered_by: string; day: string; family_id: string; hour: number; kind: string }
        Insert: { answered_at?: string; answered_by?: string; day: string; family_id: string; hour: number; kind: string }
        Update: { answered_at?: string; answered_by?: string; day?: string; family_id?: string; hour?: number; kind?: string }
        Relationships: []
      }
      push_subscriptions: {
        Row: { auth: string; created_at: string; endpoint: string; family_id: string; p256dh: string; user_id: string }
        Insert: { auth: string; created_at?: string; endpoint: string; family_id: string; p256dh: string; user_id: string }
        Update: { auth?: string; created_at?: string; endpoint?: string; family_id?: string; p256dh?: string; user_id?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_recurring: {
        Args: { _id: string }
        Returns: {
          created_at: string
          family_id: string
          id: string
          interval_days: number
          last_done: string
          next_due: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "recurring_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_family: { Args: { _name: string }; Returns: string }
      expected_routines: { Args: { _d: string }; Returns: string[] }
      homework_missing_for_close: {
        Args: { _d: string; _family_id: string }
        Returns: boolean
      }
      is_family_member: { Args: { _family_id: string }; Returns: boolean }
      is_swim_day: { Args: { _d: string }; Returns: boolean }
      join_family: { Args: { _code: string }; Returns: string }
      star_balance: { Args: { _family_id: string }; Returns: number }
      undo_completion: { Args: { _id: string }; Returns: undefined }
      save_push_subscription: { Args: { _auth: string; _endpoint: string; _family_id: string; _p256dh: string }; Returns: undefined }
      remove_push_subscription: { Args: { _endpoint: string }; Returns: undefined }
      water_slots: { Args: { _d: string }; Returns: number[] }
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
