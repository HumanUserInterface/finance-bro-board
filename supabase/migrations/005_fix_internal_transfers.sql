-- Fix existing N26 internal transfers that were imported as income/expense
-- Internal transfers in N26 start with "De " (from Espace) or "Vers " (to Espace)

-- Update transactions that start with "De " (money received from an Espace)
UPDATE public.transactions
SET
  type = 'transfer',
  category = 'Internal Transfer',
  notes = COALESCE(notes, '') || ' [Auto-fixed: internal transfer from Espace]'
WHERE description LIKE 'De %'
  AND type IN ('income', 'expense');

-- Update transactions that start with "Vers " (money sent to an Espace)
UPDATE public.transactions
SET
  type = 'transfer',
  category = 'Internal Transfer',
  notes = COALESCE(notes, '') || ' [Auto-fixed: internal transfer to Espace]'
WHERE description LIKE 'Vers %'
  AND type IN ('income', 'expense');
