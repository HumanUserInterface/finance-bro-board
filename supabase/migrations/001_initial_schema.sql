-- Finance Bro Board - Initial Database Schema
-- Run this in your Supabase SQL Editor

-- User profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income Sources
CREATE TABLE public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('salary', 'side_income', 'investments', 'rental', 'other')),
  amount DECIMAL(12,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'one_time')),
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Categories (user-customizable)
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'variable', 'bill')),
  icon TEXT,
  color TEXT,
  budget_limit DECIMAL(12,2),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses (both fixed and variable)
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
  frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually', 'one_time')),
  is_recurring BOOLEAN DEFAULT FALSE,
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills (recurring with due dates)
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  is_autopay BOOLEAN DEFAULT FALSE,
  reminder_days INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  last_paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Savings Goals
CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('emergency_fund', 'vacation', 'big_purchase', 'retirement', 'debt_payoff', 'other')),
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  target_date DATE,
  priority INTEGER DEFAULT 1,
  monthly_contribution DECIMAL(12,2),
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Requests
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT NOT NULL,
  description TEXT,
  url TEXT,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  context TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deliberating', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board Deliberations
CREATE TABLE public.deliberations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  purchase_id UUID REFERENCES public.purchase_requests(id) ON DELETE CASCADE NOT NULL,
  final_decision TEXT NOT NULL CHECK (final_decision IN ('approve', 'reject')),
  approve_count INTEGER NOT NULL,
  reject_count INTEGER NOT NULL,
  is_unanimous BOOLEAN DEFAULT FALSE,
  summary TEXT,
  total_processing_time_ms INTEGER,
  financial_context JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member Results (individual board member deliberations)
CREATE TABLE public.member_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliberation_id UUID REFERENCES public.deliberations(id) ON DELETE CASCADE NOT NULL,
  persona_slug TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  research_output JSONB NOT NULL,
  reasoning_output JSONB NOT NULL,
  critique_output JSONB NOT NULL,
  final_vote JSONB NOT NULL,
  processing_time_ms INTEGER,
  budget_analysis JSONB,
  cashflow_analysis JSONB,
  goals_analysis JSONB,
  history_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_income_sources_user ON public.income_sources(user_id);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_bills_user ON public.bills(user_id);
CREATE INDEX idx_savings_goals_user ON public.savings_goals(user_id);
CREATE INDEX idx_purchase_requests_user ON public.purchase_requests(user_id);
CREATE INDEX idx_deliberations_user ON public.deliberations(user_id);
CREATE INDEX idx_deliberations_purchase ON public.deliberations(purchase_id);
CREATE INDEX idx_member_results_deliberation ON public.member_results(deliberation_id);

-- Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own income" ON public.income_sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own categories" ON public.expense_categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own bills" ON public.bills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own goals" ON public.savings_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own purchases" ON public.purchase_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own deliberations" ON public.deliberations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own results" ON public.member_results FOR SELECT USING (
  deliberation_id IN (SELECT id FROM public.deliberations WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert own results" ON public.member_results FOR INSERT WITH CHECK (
  deliberation_id IN (SELECT id FROM public.deliberations WHERE user_id = auth.uid())
);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
