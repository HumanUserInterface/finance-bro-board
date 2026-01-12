-- Savings Accounts - Track actual savings balances
CREATE TABLE public.savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'investment', 'retirement', 'crypto', 'cash', 'other')),
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  institution TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_savings_accounts_user ON public.savings_accounts(user_id);

-- Row Level Security
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can manage own savings accounts" ON public.savings_accounts FOR ALL USING (auth.uid() = user_id);

-- Add 'failed' status to purchase_requests if not already present
ALTER TABLE public.purchase_requests DROP CONSTRAINT IF EXISTS purchase_requests_status_check;
ALTER TABLE public.purchase_requests ADD CONSTRAINT purchase_requests_status_check
  CHECK (status IN ('pending', 'deliberating', 'approved', 'rejected', 'failed'));
