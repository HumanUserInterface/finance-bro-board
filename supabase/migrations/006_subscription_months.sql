-- Migration: Add subscription_months table for month-by-month subscription management
-- This allows users to:
-- 1. Pause/skip subscriptions for specific months
-- 2. Override prices for specific months
-- 3. Track cancellation of subscriptions
-- 4. Copy subscription states from previous months

-- Add cancelled_at column to expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create subscription_months table
CREATE TABLE IF NOT EXISTS public.subscription_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  month_date DATE NOT NULL,  -- First day of month (e.g., 2026-01-01)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  amount_override DECIMAL(12,2),  -- NULL = use base expense.amount
  notes TEXT,
  copied_from_month DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, month_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subscription_months_user_month
  ON public.subscription_months(user_id, month_date);

CREATE INDEX IF NOT EXISTS idx_subscription_months_expense
  ON public.subscription_months(expense_id);

-- Enable Row Level Security
ALTER TABLE public.subscription_months ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for subscription_months
-- Users can only see and manage their own subscription month records
DROP POLICY IF EXISTS "Users can manage own subscription months" ON public.subscription_months;
CREATE POLICY "Users can manage own subscription months"
  ON public.subscription_months
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger for subscription_months
CREATE OR REPLACE FUNCTION public.update_subscription_months_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_months_updated_at ON public.subscription_months;
CREATE TRIGGER subscription_months_updated_at
  BEFORE UPDATE ON public.subscription_months
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_months_updated_at();

-- Add comment to the table
COMMENT ON TABLE public.subscription_months IS 'Stores month-specific states for subscriptions (paused, price overrides, etc.)';
COMMENT ON COLUMN public.subscription_months.month_date IS 'First day of the month (e.g., 2026-01-01)';
COMMENT ON COLUMN public.subscription_months.status IS 'active = charged this month, paused = skipped this month, cancelled = permanently ended';
COMMENT ON COLUMN public.subscription_months.amount_override IS 'Custom amount for this month only. NULL uses base expense amount.';
COMMENT ON COLUMN public.subscription_months.copied_from_month IS 'Tracks which month this state was copied from (for audit trail)';
