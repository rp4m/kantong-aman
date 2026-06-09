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
  public: {
    Tables: {
      budget_collaborators: {
        Row: {
          accepted_at: string | null
          budget_period_id: string
          id: string
          invited_at: string
          invited_email: string
          role: Database["public"]["Enums"]["collab_role"]
          status: Database["public"]["Enums"]["collab_status"]
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          budget_period_id: string
          id?: string
          invited_at?: string
          invited_email: string
          role?: Database["public"]["Enums"]["collab_role"]
          status?: Database["public"]["Enums"]["collab_status"]
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          budget_period_id?: string
          id?: string
          invited_at?: string
          invited_email?: string
          role?: Database["public"]["Enums"]["collab_role"]
          status?: Database["public"]["Enums"]["collab_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_collaborators_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          amount: number
          budget_period_id: string
          category_id: string | null
          created_at: string
          id: string
          notes: string
          pic_id: string | null
        }
        Insert: {
          amount?: number
          budget_period_id: string
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string
          pic_id?: string | null
        }
        Update: {
          amount?: number
          budget_period_id?: string
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string
          pic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_pic_id_fkey"
            columns: ["pic_id"]
            isOneToOne: false
            referencedRelation: "pics"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_periods: {
        Row: {
          created_at: string
          description: string
          end_date: string
          id: string
          name: string
          owner_user_id: string
          start_date: string
          status: Database["public"]["Enums"]["budget_status"]
        }
        Insert: {
          created_at?: string
          description?: string
          end_date: string
          id?: string
          name: string
          owner_user_id: string
          start_date: string
          status?: Database["public"]["Enums"]["budget_status"]
        }
        Update: {
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          name?: string
          owner_user_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["budget_status"]
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          owner_user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          payload: Json
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          payload?: Json
          type: Database["public"]["Enums"]["notif_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          payload?: Json
          type?: Database["public"]["Enums"]["notif_type"]
          user_id?: string
        }
        Relationships: []
      }
      pics: {
        Row: {
          created_at: string
          description: string
          email: string
          id: string
          is_active: boolean
          name: string
          owner_user_id: string
          phone: string
        }
        Insert: {
          created_at?: string
          description?: string
          email?: string
          id?: string
          is_active?: boolean
          name: string
          owner_user_id: string
          phone?: string
        }
        Update: {
          created_at?: string
          description?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_user_id?: string
          phone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          budget_item_id: string | null
          budget_period_id: string | null
          category: string
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          budget_item_id?: string | null
          budget_period_id?: string | null
          category: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          notes?: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          budget_item_id?: string | null
          budget_period_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_budget_period_id_fkey"
            columns: ["budget_period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_budget_access: {
        Args: {
          _budget_id: string
          _min_role: Database["public"]["Enums"]["collab_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_budget_owner: {
        Args: { _budget_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      budget_status: "draft" | "active" | "closed"
      collab_role: "owner" | "collaborator" | "viewer"
      collab_status: "pending" | "accepted" | "rejected"
      notif_type:
        | "invitation_received"
        | "invitation_accepted"
        | "transaction_added"
        | "budget_updated"
        | "collaborator_added"
        | "collaborator_removed"
      tx_type: "income" | "expense"
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
      budget_status: ["draft", "active", "closed"],
      collab_role: ["owner", "collaborator", "viewer"],
      collab_status: ["pending", "accepted", "rejected"],
      notif_type: [
        "invitation_received",
        "invitation_accepted",
        "transaction_added",
        "budget_updated",
        "collaborator_added",
        "collaborator_removed",
      ],
      tx_type: ["income", "expense"],
    },
  },
} as const
