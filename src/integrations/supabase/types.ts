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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string
          deadline: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["admin_task_status"]
          team_id: string | null
          title: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["admin_task_status"]
          team_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["admin_task_status"]
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          admin_comment: string | null
          amount_to_refund: number
          created_at: string
          generation_id: string
          id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          screenshot_url: string | null
          screenshot_urls: Json | null
          status: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount_to_refund?: number
          created_at?: string
          generation_id: string
          id?: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          screenshot_urls?: Json | null
          status?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount_to_refund?: number
          created_at?: string
          generation_id?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          screenshot_urls?: Json | null
          status?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generation_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_requests: {
        Row: {
          admin_comment: string | null
          amount: number
          created_at: string
          id: string
          note: string
          processed_at: string | null
          processed_by: string | null
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount: number
          created_at?: string
          id?: string
          note: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount?: number
          created_at?: string
          id?: string
          note?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_transactions: {
        Row: {
          admin_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          note: string
          team_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          note: string
          team_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          note?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_history: {
        Row: {
          admin_note: string | null
          ai_model: string | null
          assigned_admin_id: string | null
          color_scheme: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          files_data: Json | null
          generation_cost: number | null
          geo: string | null
          id: string
          image_source: string | null
          improved_prompt: string | null
          language: string
          layout_style: string | null
          number: number
          prompt: string
          retry_count: number | null
          sale_price: number | null
          site_name: string | null
          specific_ai_model: string | null
          status: string
          taken_at: string | null
          team_id: string | null
          total_generation_cost: number | null
          user_id: string | null
          vip_prompt: string | null
          website_type: string | null
          zip_data: string | null
        }
        Insert: {
          admin_note?: string | null
          ai_model?: string | null
          assigned_admin_id?: string | null
          color_scheme?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          files_data?: Json | null
          generation_cost?: number | null
          geo?: string | null
          id?: string
          image_source?: string | null
          improved_prompt?: string | null
          language?: string
          layout_style?: string | null
          number?: number
          prompt: string
          retry_count?: number | null
          sale_price?: number | null
          site_name?: string | null
          specific_ai_model?: string | null
          status?: string
          taken_at?: string | null
          team_id?: string | null
          total_generation_cost?: number | null
          user_id?: string | null
          vip_prompt?: string | null
          website_type?: string | null
          zip_data?: string | null
        }
        Update: {
          admin_note?: string | null
          ai_model?: string | null
          assigned_admin_id?: string | null
          color_scheme?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          files_data?: Json | null
          generation_cost?: number | null
          geo?: string | null
          id?: string
          image_source?: string | null
          improved_prompt?: string | null
          language?: string
          layout_style?: string | null
          number?: number
          prompt?: string
          retry_count?: number | null
          sale_price?: number | null
          site_name?: string | null
          specific_ai_model?: string | null
          status?: string
          taken_at?: string | null
          team_id?: string | null
          total_generation_cost?: number | null
          user_id?: string | null
          vip_prompt?: string | null
          website_type?: string | null
          zip_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_spends: {
        Row: {
          created_at: string
          currency: string
          generation_id: string
          id: string
          is_favorite: boolean
          notes: string | null
          spend_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          generation_id: string
          id?: string
          is_favorite?: boolean
          notes?: string | null
          spend_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          generation_id?: string
          id?: string
          is_favorite?: boolean
          notes?: string | null
          spend_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_spends_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generation_history"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          assigned_role: Database["public"]["Enums"]["team_role"] | null
          code: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          team_id: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          assigned_role?: Database["public"]["Enums"]["team_role"] | null
          code: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          team_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["team_role"] | null
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          team_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_mode: {
        Row: {
          enabled: boolean
          id: string
          message: string | null
          support_link: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          message?: string | null
          support_link?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          message?: string | null
          support_link?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_address_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          network: string
          new_address: string
          old_address: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          network: string
          new_address: string
          old_address?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          network?: string
          new_address?: string
          old_address?: string | null
        }
        Relationships: []
      }
      payment_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          network: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          network: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          network?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_blocked: boolean
          max_concurrent_generations: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_blocked?: boolean
          max_concurrent_generations?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_blocked?: boolean
          max_concurrent_generations?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          author: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          text: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          text: string
        }
        Update: {
          author?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          text?: string
        }
        Relationships: []
      }
      referral_invites: {
        Row: {
          code: string
          created_at: string
          id: string
          invited_team_id: string | null
          invited_user_id: string | null
          is_active: boolean
          milestone_reached: boolean
          referrer_team_id: string | null
          referrer_user_id: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          invited_team_id?: string | null
          invited_user_id?: string | null
          is_active?: boolean
          milestone_reached?: boolean
          referrer_team_id?: string | null
          referrer_user_id: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          invited_team_id?: string | null
          invited_user_id?: string | null
          is_active?: boolean
          milestone_reached?: boolean
          referrer_team_id?: string | null
          referrer_user_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_invites_invited_team_id_fkey"
            columns: ["invited_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_invites_referrer_team_id_fkey"
            columns: ["referrer_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          admin_comment: string | null
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          referral_invite_id: string
          reward_type: string
          status: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          referral_invite_id: string
          reward_type: string
          status?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          referral_invite_id?: string
          reward_type?: string
          status?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_invite_id_fkey"
            columns: ["referral_invite_id"]
            isOneToOne: false
            referencedRelation: "referral_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          default_max_referral_invites: number
          id: string
          invite_reward: number
          milestone_generations: number
          milestone_reward: number
          new_user_bonus: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          default_max_referral_invites?: number
          id?: string
          invite_reward?: number
          milestone_generations?: number
          milestone_reward?: number
          new_user_bonus?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          default_max_referral_invites?: number
          id?: string
          invite_reward?: number
          milestone_generations?: number
          milestone_reward?: number
          new_user_bonus?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      spend_sets: {
        Row: {
          created_at: string
          generation_ids: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_ids?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generation_ids?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_limits: {
        Row: {
          active_generations: number
          id: string
          max_concurrent_generations: number
          max_generations_per_user: number
          updated_at: string
        }
        Insert: {
          active_generations?: number
          id?: string
          max_concurrent_generations?: number
          max_generations_per_user?: number
          updated_at?: string
        }
        Update: {
          active_generations?: number
          id?: string
          max_concurrent_generations?: number
          max_generations_per_user?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          created_at: string
          id: string
          message: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: Database["public"]["Enums"]["admin_task_status"]
          old_status: Database["public"]["Enums"]["admin_task_status"] | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: Database["public"]["Enums"]["admin_task_status"]
          old_status?: Database["public"]["Enums"]["admin_task_status"] | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["admin_task_status"]
          old_status?: Database["public"]["Enums"]["admin_task_status"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          status: Database["public"]["Enums"]["member_status"]
          team_id: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_pricing: {
        Row: {
          created_at: string
          external_price: number | null
          generation_cost_junior: number
          generation_cost_senior: number
          html_price: number
          id: string
          react_price: number
          team_id: string
          updated_at: string
          vip_extra_price: number | null
        }
        Insert: {
          created_at?: string
          external_price?: number | null
          generation_cost_junior?: number
          generation_cost_senior?: number
          html_price?: number
          id?: string
          react_price?: number
          team_id: string
          updated_at?: string
          vip_extra_price?: number | null
        }
        Update: {
          created_at?: string
          external_price?: number | null
          generation_cost_junior?: number
          generation_cost_senior?: number
          html_price?: number
          id?: string
          react_price?: number
          team_id?: string
          updated_at?: string
          vip_extra_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_pricing_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          assigned_admin_id: string | null
          balance: number
          created_at: string
          created_by: string
          credit_limit: number
          id: string
          max_referral_invites: number
          name: string
        }
        Insert: {
          assigned_admin_id?: string | null
          balance?: number
          created_at?: string
          created_by: string
          credit_limit?: number
          id?: string
          max_referral_invites?: number
          name: string
        }
        Update: {
          assigned_admin_id?: string | null
          balance?: number
          created_at?: string
          created_by?: string
          credit_limit?: number
          id?: string
          max_referral_invites?: number
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_active_generations: { Args: never; Returns: undefined }
      get_task_indicators: {
        Args: { p_user_id: string }
        Returns: {
          has_new_tasks: boolean
          has_problematic: boolean
        }[]
      }
      get_user_active_generations: {
        Args: { p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_active_generations: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      register_with_invite_code: {
        Args: { p_invite_code: string; p_user_id: string }
        Returns: Json
      }
      validate_invite_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      admin_task_status: "todo" | "in_progress" | "done" | "problematic"
      app_role: "admin" | "user" | "super_admin"
      member_status: "pending" | "approved" | "rejected"
      task_priority: "low" | "medium" | "high"
      team_role: "owner" | "team_lead" | "buyer" | "tech_dev"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_task_status: ["todo", "in_progress", "done", "problematic"],
      app_role: ["admin", "user", "super_admin"],
      member_status: ["pending", "approved", "rejected"],
      task_priority: ["low", "medium", "high"],
      team_role: ["owner", "team_lead", "buyer", "tech_dev"],
    },
  },
} as const
