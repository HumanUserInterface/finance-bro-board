export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          currency: string;
          timezone: string;
          onboarding_completed: boolean;
          onboarding_completed_at: string | null;
          monthly_income_last_updated: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          timezone?: string;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          monthly_income_last_updated?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          currency?: string;
          timezone?: string;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          monthly_income_last_updated?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      income_sources: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'salary' | 'side_income' | 'investments' | 'rental' | 'other';
          amount: number;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time';
          is_active: boolean;
          start_date: string | null;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'salary' | 'side_income' | 'investments' | 'rental' | 'other';
          amount: number;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time';
          is_active?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          type?: 'salary' | 'side_income' | 'investments' | 'rental' | 'other';
          amount?: number;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time';
          is_active?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'fixed' | 'variable' | 'bill';
          icon: string | null;
          color: string | null;
          budget_limit: number | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'fixed' | 'variable' | 'bill';
          icon?: string | null;
          color?: string | null;
          budget_limit?: number | null;
          is_default?: boolean;
        };
        Update: {
          name?: string;
          type?: 'fixed' | 'variable' | 'bill';
          icon?: string | null;
          color?: string | null;
          budget_limit?: number | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          name: string;
          amount: number;
          type: 'fixed' | 'variable';
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | null;
          is_recurring: boolean;
          due_day: number | null;
          start_date: string | null;
          end_date: string | null;
          notes: string | null;
          is_active: boolean;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          name: string;
          amount: number;
          type: 'fixed' | 'variable';
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | null;
          is_recurring?: boolean;
          due_day?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          is_active?: boolean;
          cancelled_at?: string | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          amount?: number;
          type?: 'fixed' | 'variable';
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'one_time' | null;
          is_recurring?: boolean;
          due_day?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          is_active?: boolean;
          cancelled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          name: string;
          amount: number;
          due_day: number;
          frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
          is_autopay: boolean;
          reminder_days: number;
          is_active: boolean;
          last_paid_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          name: string;
          amount: number;
          due_day: number;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
          is_autopay?: boolean;
          reminder_days?: number;
          is_active?: boolean;
          last_paid_date?: string | null;
          notes?: string | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          amount?: number;
          due_day?: number;
          frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
          is_autopay?: boolean;
          reminder_days?: number;
          is_active?: boolean;
          last_paid_date?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'emergency_fund' | 'vacation' | 'big_purchase' | 'retirement' | 'debt_payoff' | 'other';
          target_amount: number;
          current_amount: number;
          target_date: string | null;
          priority: number;
          monthly_contribution: number | null;
          icon: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'emergency_fund' | 'vacation' | 'big_purchase' | 'retirement' | 'debt_payoff' | 'other';
          target_amount: number;
          current_amount?: number;
          target_date?: string | null;
          priority?: number;
          monthly_contribution?: number | null;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          type?: 'emergency_fund' | 'vacation' | 'big_purchase' | 'retirement' | 'debt_payoff' | 'other';
          target_amount?: number;
          current_amount?: number;
          target_date?: string | null;
          priority?: number;
          monthly_contribution?: number | null;
          icon?: string | null;
          color?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_requests: {
        Row: {
          id: string;
          user_id: string;
          item: string;
          price: number;
          currency: string;
          category: string;
          description: string | null;
          url: string | null;
          urgency: 'low' | 'medium' | 'high';
          context: string | null;
          status: 'pending' | 'deliberating' | 'approved' | 'rejected' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item: string;
          price: number;
          currency?: string;
          category: string;
          description?: string | null;
          url?: string | null;
          urgency: 'low' | 'medium' | 'high';
          context?: string | null;
          status?: 'pending' | 'deliberating' | 'approved' | 'rejected' | 'failed';
        };
        Update: {
          item?: string;
          price?: number;
          currency?: string;
          category?: string;
          description?: string | null;
          url?: string | null;
          urgency?: 'low' | 'medium' | 'high';
          context?: string | null;
          status?: 'pending' | 'deliberating' | 'approved' | 'rejected' | 'failed';
          updated_at?: string;
        };
        Relationships: [];
      };
      deliberations: {
        Row: {
          id: string;
          user_id: string;
          purchase_id: string;
          final_decision: 'approve' | 'reject';
          approve_count: number;
          reject_count: number;
          is_unanimous: boolean;
          summary: string | null;
          total_processing_time_ms: number | null;
          financial_context: Json | null;
          started_at: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          purchase_id: string;
          final_decision: 'approve' | 'reject';
          approve_count: number;
          reject_count: number;
          is_unanimous?: boolean;
          summary?: string | null;
          total_processing_time_ms?: number | null;
          financial_context?: Json | null;
          started_at: string;
          completed_at: string;
        };
        Update: {
          final_decision?: 'approve' | 'reject';
          approve_count?: number;
          reject_count?: number;
          is_unanimous?: boolean;
          summary?: string | null;
          total_processing_time_ms?: number | null;
          financial_context?: Json | null;
        };
        Relationships: [];
      };
      member_results: {
        Row: {
          id: string;
          deliberation_id: string;
          persona_slug: string;
          persona_name: string;
          research_output: Json;
          reasoning_output: Json;
          critique_output: Json;
          final_vote: Json;
          processing_time_ms: number | null;
          budget_analysis: Json | null;
          cashflow_analysis: Json | null;
          goals_analysis: Json | null;
          history_analysis: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deliberation_id: string;
          persona_slug: string;
          persona_name: string;
          research_output: Json;
          reasoning_output: Json;
          critique_output: Json;
          final_vote: Json;
          processing_time_ms?: number | null;
          budget_analysis?: Json | null;
          cashflow_analysis?: Json | null;
          goals_analysis?: Json | null;
          history_analysis?: Json | null;
        };
        Update: {
          research_output?: Json;
          reasoning_output?: Json;
          critique_output?: Json;
          final_vote?: Json;
          processing_time_ms?: number | null;
        };
        Relationships: [];
      };
      monthly_budgets: {
        Row: {
          id: string;
          user_id: string;
          month_date: string;
          wants: Json;
          savings: Json;
          total_income: number | null;
          copied_from_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_date: string;
          wants?: Json;
          savings?: Json;
          total_income?: number | null;
          copied_from_month?: string | null;
        };
        Update: {
          wants?: Json;
          savings?: Json;
          total_income?: number | null;
          copied_from_month?: string | null;
          updated_at?: string;
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

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Monthly budget item types
export interface MonthlyBudgetWant {
  name: string;
  amount: number;
}

export interface MonthlyBudgetSaving {
  name: string;
  amount: number;
  savings_goal_id?: string;
}
