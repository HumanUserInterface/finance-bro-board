-- Add "Debt" category for all users
-- Run this in your Supabase SQL Editor

-- First, find your user_id by running this query:
-- SELECT id, email FROM auth.users LIMIT 10;

-- Then replace 'YOUR_USER_ID_HERE' with your actual UUID and run:

INSERT INTO public.expense_categories (user_id, name, type, budget_limit)
VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with your actual user ID
  'Debt',
  'fixed',
  0
)
ON CONFLICT DO NOTHING;
