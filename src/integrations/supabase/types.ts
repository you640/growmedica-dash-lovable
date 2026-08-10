export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      integrations: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          is_active: boolean;
          last_error: string | null;
          last_tested_at: string | null;
          name: string;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_tested_at?: string | null;
          name: string;
          provider: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_error?: string | null;
          last_tested_at?: string | null;
          name?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_jobs: {
        Row: {
          created_at: string;
          finished_at: string | null;
          id: string;
          job_type: string;
          progress: number;
          provider: string;
          result: Json | null;
          started_at: string | null;
          status: string;
          total: number;
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type: string;
          progress?: number;
          provider: string;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
          total?: number;
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type?: string;
          progress?: number;
          provider?: string;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
          total?: number;
        };
        Relationships: [];
      };
      wc_customers: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          orders_count: number | null;
          raw: Json;
          total_spent: number | null;
          updated_at: string;
          username: string | null;
          wp_created_at: string | null;
          wp_id: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          orders_count?: number | null;
          raw?: Json;
          total_spent?: number | null;
          updated_at?: string;
          username?: string | null;
          wp_created_at?: string | null;
          wp_id: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          orders_count?: number | null;
          raw?: Json;
          total_spent?: number | null;
          updated_at?: string;
          username?: string | null;
          wp_created_at?: string | null;
          wp_id?: number;
        };
        Relationships: [];
      };
      wc_orders: {
        Row: {
          created_at: string;
          currency: string | null;
          customer_email: string | null;
          customer_name: string | null;
          customer_wp_id: number | null;
          deleted_at: string | null;
          id: string;
          item_count: number | null;
          number: string | null;
          payment_method: string | null;
          raw: Json;
          status: string | null;
          total: number | null;
          updated_at: string;
          wp_created_at: string | null;
          wp_id: number;
          wp_modified_at: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_wp_id?: number | null;
          deleted_at?: string | null;
          id?: string;
          item_count?: number | null;
          number?: string | null;
          payment_method?: string | null;
          raw?: Json;
          status?: string | null;
          total?: number | null;
          updated_at?: string;
          wp_created_at?: string | null;
          wp_id: number;
          wp_modified_at?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_wp_id?: number | null;
          deleted_at?: string | null;
          id?: string;
          item_count?: number | null;
          number?: string | null;
          payment_method?: string | null;
          raw?: Json;
          status?: string | null;
          total?: number | null;
          updated_at?: string;
          wp_created_at?: string | null;
          wp_id?: number;
          wp_modified_at?: string | null;
        };
        Relationships: [];
      };
      webhook_endpoints: {
        Row: {
          created_at: string;
          events: string[];
          framework: string | null;
          id: string;
          is_active: boolean;
          name: string;
          secret_hash: string | null;
          target_url: string;
        };
        Insert: {
          created_at?: string;
          events: string[];
          framework?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          secret_hash?: string | null;
          target_url: string;
        };
        Update: {
          created_at?: string;
          events?: string[];
          framework?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          secret_hash?: string | null;
          target_url?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          payload: Json | null;
          relayed_to: string[] | null;
          source: string;
          status: string;
          topic: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json | null;
          relayed_to?: string[] | null;
          source: string;
          status?: string;
          topic: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          payload?: Json | null;
          relayed_to?: string[] | null;
          source?: string;
          status?: string;
          topic?: string;
        };
        Relationships: [];
      };
      wp_content: {
        Row: {
          alt_text: string | null;
          author: string | null;
          content_type: string;
          created_at: string;
          deleted_at: string | null;
          excerpt: string | null;
          id: string;
          image_url: string | null;
          link: string | null;
          price: number | null;
          raw: Json;
          slug: string | null;
          status: string | null;
          stock_quantity: number | null;
          stock_status: string | null;
          title: string | null;
          updated_at: string;
          wp_created_at: string | null;
          wp_id: number;
          wp_modified_at: string | null;
        };
        Insert: {
          alt_text?: string | null;
          author?: string | null;
          content_type: string;
          created_at?: string;
          deleted_at?: string | null;
          excerpt?: string | null;
          id?: string;
          image_url?: string | null;
          link?: string | null;
          price?: number | null;
          raw?: Json;
          slug?: string | null;
          status?: string | null;
          stock_quantity?: number | null;
          stock_status?: string | null;
          title?: string | null;
          updated_at?: string;
          wp_created_at?: string | null;
          wp_id: number;
          wp_modified_at?: string | null;
        };
        Update: {
          alt_text?: string | null;
          author?: string | null;
          content_type?: string;
          created_at?: string;
          deleted_at?: string | null;
          excerpt?: string | null;
          id?: string;
          image_url?: string | null;
          link?: string | null;
          price?: number | null;
          raw?: Json;
          slug?: string | null;
          status?: string | null;
          stock_quantity?: number | null;
          stock_status?: string | null;
          title?: string | null;
          updated_at?: string;
          wp_created_at?: string | null;
          wp_id?: number;
          wp_modified_at?: string | null;
        };
        Relationships: [];
      };
      wp_plugins: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          last_synced_at: string;
          name: string | null;
          plugin_slug: string;
          raw: Json;
          update_available: string | null;
          updated_at: string;
          version: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string;
          name?: string | null;
          plugin_slug: string;
          raw?: Json;
          update_available?: string | null;
          updated_at?: string;
          version?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_synced_at?: string;
          name?: string | null;
          plugin_slug?: string;
          raw?: Json;
          update_available?: string | null;
          updated_at?: string;
          version?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
