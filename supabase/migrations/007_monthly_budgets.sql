-- Migration: Add monthly_budgets table for month-by-month budget tracking
-- This allows users to:
-- 1. Set different budget allocations for each month
-- 2. Copy budgets from previous months
-- 3. Track income snapshot for each month
-- 4. Have independent want/savings allocations per month

-- Create monthly_budgets table
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month_date DATE NOT NULL,  -- First day of month (e.g., 2026-01-01)
  -- Budget allocations stored as JSONB for flexibility
  wants JSONB DEFAULT '[]',  -- [{name, amount}]
  savings JSONB DEFAULT '[]', -- [{name, amount, savings_goal_id?}]
  total_income DECIMAL(12,2), -- Snapshot of income for this month
  copied_from_month DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_budgets_user_month
  ON public.monthly_budgets(user_id, month_date);

-- Enable Row Level Security
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for monthly_budgets
-- Users can only see and manage their own monthly budget records
DROP POLICY IF EXISTS "Users can manage own monthly budgets" ON public.monthly_budgets;
CREATE POLICY "Users can manage own monthly budgets"
  ON public.monthly_budgets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger for monthly_budgets
CREATE OR REPLACE FUNCTION public.update_monthly_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monthly_budgets_updated_at ON public.monthly_budgets;
CREATE TRIGGER monthly_budgets_updated_at
  BEFORE UPDATE ON public.monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_monthly_budgets_updated_at();

-- Add comments to the table
COMMENT ON TABLE public.monthly_budgets IS 'Stores month-specific budget allocations for wants and savings';
COMMENT ON COLUMN public.monthly_budgets.month_date IS 'First day of the month (e.g., 2026-01-01)';
COMMENT ON COLUMN public.monthly_budgets.wants IS 'Array of want categories: [{name: string, amount: number}]';
COMMENT ON COLUMN public.monthly_budgets.savings IS 'Array of savings allocations: [{name: string, amount: number, savings_goal_id?: string}]';
COMMENT ON COLUMN public.monthly_budgets.total_income IS 'Snapshot of total income when this budget was created';
COMMENT ON COLUMN public.monthly_budgets.copied_from_month IS 'Tracks which month this budget was copied from (for audit trail)';
