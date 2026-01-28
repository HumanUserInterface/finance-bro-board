import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database';

type Expense = Tables<'expenses'>;
type SubscriptionMonth = Tables<'subscription_months'>;

export interface SubscriptionWithMonthState extends Expense {
  monthState: SubscriptionMonth | null;
  effectiveAmount: number;
  effectiveStatus: 'active' | 'paused' | 'cancelled';
}

export interface MonthlyTotal {
  month: string;
  total: number;
  activeCount: number;
  pausedCount: number;
  cancelledCount: number;
}

/**
 * Get the first day of a month in YYYY-MM-DD format
 */
export function getMonthDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Parse a month date string into year and month
 */
export function parseMonthDate(monthDate: string): { year: number; month: number } {
  const [year, month] = monthDate.split('-').map(Number);
  return { year, month };
}

/**
 * Get previous month date string
 */
export function getPreviousMonth(monthDate: string): string {
  const { year, month } = parseMonthDate(monthDate);
  if (month === 1) {
    return getMonthDate(year - 1, 12);
  }
  return getMonthDate(year, month - 1);
}

/**
 * Get all subscriptions (recurring expenses) for a specific month with their month state
 * Only returns subscriptions that started on or before this month
 */
export async function getSubscriptionsForMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  monthDate: string
): Promise<SubscriptionWithMonthState[]> {
  // Get all recurring expenses that are not permanently cancelled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expenses, error: expensesError } = await (supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .eq('is_active', true)
    .is('cancelled_at', null) as any);

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError);
    return [];
  }

  if (!expenses || expenses.length === 0) {
    return [];
  }

  // Filter expenses to only include those that started on or before this month
  // If start_date is null, include it (legacy data)
  const filteredExpenses = expenses.filter((expense: Expense) => {
    if (!expense.start_date) return true; // No start date = show everywhere (legacy)
    return expense.start_date <= monthDate;
  });

  if (filteredExpenses.length === 0) {
    return [];
  }

  // Get month states for these expenses
  const expenseIds = filteredExpenses.map((e: Expense) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: monthStates, error: monthError } = await (supabase
    .from('subscription_months')
    .select('*')
    .eq('user_id', userId)
    .eq('month_date', monthDate)
    .in('expense_id', expenseIds) as any);

  if (monthError) {
    console.error('Error fetching month states:', monthError);
  }

  // Create a map for quick lookup
  const monthStateMap = new Map<string, SubscriptionMonth>();
  if (monthStates) {
    monthStates.forEach((state: SubscriptionMonth) => {
      monthStateMap.set(state.expense_id, state);
    });
  }

  // Combine expenses with their month states
  return filteredExpenses.map((expense: Expense) => {
    const monthState = monthStateMap.get(expense.id) || null;
    return {
      ...expense,
      monthState,
      effectiveAmount: monthState?.amount_override ?? expense.amount,
      effectiveStatus: monthState?.status ?? 'active',
    };
  });
}

/**
 * Copy subscription states from a previous month to a target month
 */
export async function copyFromPreviousMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetMonth: string,
  sourceMonth?: string
): Promise<{ success: boolean; copied: number; error?: string }> {
  const source = sourceMonth || getPreviousMonth(targetMonth);

  // Get all subscriptions for the user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: expenses, error: expensesError } = await (supabase
    .from('expenses')
    .select('id')
    .eq('user_id', userId)
    .eq('is_recurring', true)
    .eq('is_active', true)
    .is('cancelled_at', null) as any);

  if (expensesError || !expenses) {
    return { success: false, copied: 0, error: 'Failed to fetch expenses' };
  }

  if (expenses.length === 0) {
    return { success: true, copied: 0 };
  }

  // Get source month states
  const expenseIds = expenses.map((e: { id: string }) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sourceStates } = await (supabase
    .from('subscription_months')
    .select('*')
    .eq('user_id', userId)
    .eq('month_date', source)
    .in('expense_id', expenseIds) as any);

  // Delete existing states for target month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase
    .from('subscription_months')
    .delete()
    .eq('user_id', userId)
    .eq('month_date', targetMonth) as any);

  // Copy states from source month (only for paused/cancelled or overridden amounts)
  const statesToCopy = (sourceStates || [])
    .filter((state: SubscriptionMonth) =>
      state.status !== 'active' || state.amount_override !== null
    )
    .map((state: SubscriptionMonth) => ({
      user_id: userId,
      expense_id: state.expense_id,
      month_date: targetMonth,
      status: state.status === 'cancelled' ? 'cancelled' : state.status, // Carry cancelled forward
      amount_override: state.amount_override,
      notes: state.notes,
      copied_from_month: source,
    }));

  if (statesToCopy.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase
      .from('subscription_months')
      .insert(statesToCopy) as any);

    if (insertError) {
      return { success: false, copied: 0, error: 'Failed to copy states' };
    }
  }

  return { success: true, copied: statesToCopy.length };
}

/**
 * Update subscription status for a specific month
 */
export async function updateSubscriptionStatus(
  supabase: SupabaseClient<Database>,
  userId: string,
  expenseId: string,
  monthDate: string,
  status: 'active' | 'paused' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  // Check if a month state already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase
    .from('subscription_months')
    .select('id, amount_override')
    .eq('user_id', userId)
    .eq('expense_id', expenseId)
    .eq('month_date', monthDate)
    .single() as any);

  if (existing) {
    // Update existing
    if (status === 'active' && existing.amount_override === null) {
      // If going back to active with no override, delete the record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('subscription_months')
        .delete()
        .eq('id', existing.id) as any);

      return { success: !error, error: error?.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('subscription_months') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    return { success: !error, error: error?.message };
  }

  // Create new month state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('subscription_months') as any).insert({
    user_id: userId,
    expense_id: expenseId,
    month_date: monthDate,
    status,
  });

  return { success: !error, error: error?.message };
}

/**
 * Update subscription amount override for a specific month
 */
export async function updateSubscriptionAmount(
  supabase: SupabaseClient<Database>,
  userId: string,
  expenseId: string,
  monthDate: string,
  amount: number | null // null to remove override
): Promise<{ success: boolean; error?: string }> {
  // Check if a month state already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase
    .from('subscription_months')
    .select('id, status')
    .eq('user_id', userId)
    .eq('expense_id', expenseId)
    .eq('month_date', monthDate)
    .single() as any);

  if (existing) {
    if (amount === null && existing.status === 'active') {
      // If removing override and status is active, delete the record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase
        .from('subscription_months')
        .delete()
        .eq('id', existing.id) as any);

      return { success: !error, error: error?.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('subscription_months') as any)
      .update({ amount_override: amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    return { success: !error, error: error?.message };
  }

  if (amount === null) {
    // Nothing to do - no override and no existing record
    return { success: true };
  }

  // Create new month state with amount override
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('subscription_months') as any).insert({
    user_id: userId,
    expense_id: expenseId,
    month_date: monthDate,
    status: 'active',
    amount_override: amount,
  });

  return { success: !error, error: error?.message };
}

/**
 * Cancel a subscription permanently (across all future months)
 */
export async function cancelSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  expenseId: string,
  effectiveMonth: string
): Promise<{ success: boolean; error?: string }> {
  // Mark the expense as cancelled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: expenseError } = await (supabase.from('expenses') as any)
    .update({
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId)
    .eq('user_id', userId);

  if (expenseError) {
    return { success: false, error: expenseError.message };
  }

  // Also mark the month state as cancelled for the effective month
  await updateSubscriptionStatus(supabase, userId, expenseId, effectiveMonth, 'cancelled');

  return { success: true };
}

/**
 * Reactivate a cancelled subscription
 */
export async function reactivateSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('expenses') as any)
    .update({
      cancelled_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', expenseId)
    .eq('user_id', userId);

  return { success: !error, error: error?.message };
}

/**
 * Get monthly totals for comparison across multiple months
 */
export async function getMonthlyTotals(
  supabase: SupabaseClient<Database>,
  userId: string,
  months: string[]
): Promise<MonthlyTotal[]> {
  const results: MonthlyTotal[] = [];

  for (const month of months) {
    const subscriptions = await getSubscriptionsForMonth(supabase, userId, month);

    let total = 0;
    let activeCount = 0;
    let pausedCount = 0;
    let cancelledCount = 0;

    for (const sub of subscriptions) {
      if (sub.effectiveStatus === 'active') {
        // Calculate monthly equivalent
        const multipliers: Record<string, number> = {
          weekly: 4.33,
          biweekly: 2.17,
          monthly: 1,
          quarterly: 0.33,
          annually: 0.083,
        };
        const multiplier = multipliers[sub.frequency || 'monthly'] || 1;
        total += sub.effectiveAmount * multiplier;
        activeCount++;
      } else if (sub.effectiveStatus === 'paused') {
        pausedCount++;
      } else {
        cancelledCount++;
      }
    }

    results.push({
      month,
      total,
      activeCount,
      pausedCount,
      cancelledCount,
    });
  }

  return results;
}

/**
 * Check if month has been initialized (has any subscription month records)
 */
export async function isMonthInitialized(
  supabase: SupabaseClient<Database>,
  userId: string,
  monthDate: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase
    .from('subscription_months')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('month_date', monthDate) as any);

  if (error) {
    console.error('Error checking month initialization:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Initialize a month with default active states for all subscriptions
 * This is called when viewing a new month for the first time
 */
export async function initializeMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
  monthDate: string,
  copyFromPrevious: boolean = true
): Promise<{ success: boolean; error?: string }> {
  if (copyFromPrevious) {
    const result = await copyFromPreviousMonth(supabase, userId, monthDate);
    return { success: result.success, error: result.error };
  }

  // If not copying, the month is considered initialized with default states
  // No records needed for default active state
  return { success: true };
}
