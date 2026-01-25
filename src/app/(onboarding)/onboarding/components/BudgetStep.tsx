'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Target, PiggyBank } from 'lucide-react';

interface BudgetStepProps {
  totalIncome: number;
  onComplete: () => void;
  onBack: () => void;
}

interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
  type: 'need' | 'want' | 'saving';
  categoryType: 'fixed' | 'variable';
  isSavingsGoal?: boolean;
}

const DEFAULT_CATEGORIES: Omit<BudgetCategory, 'amount' | 'percentage'>[] = [
  // Needs (50%)
  { name: 'Rent', type: 'need', categoryType: 'fixed' },
  { name: 'Utilities', type: 'need', categoryType: 'fixed' },
  { name: 'Internet', type: 'need', categoryType: 'fixed' },
  { name: 'Insurance', type: 'need', categoryType: 'fixed' },
  // Wants (30%)
  { name: 'Groceries', type: 'want', categoryType: 'variable' },
  { name: 'Transport', type: 'want', categoryType: 'variable' },
  { name: 'Entertainment', type: 'want', categoryType: 'variable' },
  { name: 'Shopping', type: 'want', categoryType: 'variable' },
  // Savings (20%)
  { name: 'Emergency Fund', type: 'saving', categoryType: 'variable', isSavingsGoal: true },
  { name: 'Projects', type: 'saving', categoryType: 'variable', isSavingsGoal: true },
];

const DEFAULT_PERCENTAGES = {
  need: { total: 50, items: [35, 5, 3, 7] }, // Rent, Utilities, Internet, Insurance
  want: { total: 30, items: [15, 5, 5, 5] }, // Groceries, Transport, Entertainment, Shopping
  saving: { total: 20, items: [15, 5] }, // Emergency Fund, Projects
};

export function BudgetStep({ totalIncome, onComplete, onBack }: BudgetStepProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize categories with default 50/30/20 split
  useEffect(() => {
    const initialCategories: BudgetCategory[] = [];
    let needIndex = 0;
    let wantIndex = 0;
    let savingIndex = 0;

    DEFAULT_CATEGORIES.forEach((cat) => {
      let percentage = 0;
      if (cat.type === 'need') {
        percentage = DEFAULT_PERCENTAGES.need.items[needIndex++];
      } else if (cat.type === 'want') {
        percentage = DEFAULT_PERCENTAGES.want.items[wantIndex++];
      } else if (cat.type === 'saving') {
        percentage = DEFAULT_PERCENTAGES.saving.items[savingIndex++];
      }

      initialCategories.push({
        ...cat,
        percentage,
        amount: (totalIncome * percentage) / 100,
      });
    });

    setCategories(initialCategories);
  }, [totalIncome]);

  const updateCategory = (index: number, updates: Partial<BudgetCategory>) => {
    setCategories((prev) =>
      prev.map((cat, i) => {
        if (i === index) {
          const updated = { ...cat, ...updates };
          // If amount changed, update percentage
          if (updates.amount !== undefined) {
            updated.percentage = totalIncome > 0 ? (updates.amount / totalIncome) * 100 : 0;
          }
          // If percentage changed, update amount
          if (updates.percentage !== undefined) {
            updated.amount = (totalIncome * updates.percentage) / 100;
          }
          return updated;
        }
        return cat;
      })
    );
  };

  const addCategory = (type: 'need' | 'want' | 'saving') => {
    const newCategory: BudgetCategory = {
      name: '',
      amount: 0,
      percentage: 0,
      type,
      categoryType: type === 'need' ? 'fixed' : 'variable',
      isSavingsGoal: type === 'saving',
    };
    setCategories((prev) => [...prev, newCategory]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const byType = {
      need: 0,
      want: 0,
      saving: 0,
    };

    categories.forEach((cat) => {
      byType[cat.type] += cat.percentage;
    });

    const total = byType.need + byType.want + byType.saving;

    return { byType, total };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Not authenticated');
      }

      // Check for existing expenses to avoid duplicates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingExpenses } = await (supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id) as any);

      const hasExistingData = existingExpenses && existingExpenses.length > 0;

      // Only create expenses if user has no existing data
      if (!hasExistingData) {
        // Create expense categories
        const expenseCategories = categories.filter((cat) => !cat.isSavingsGoal);
        const categoryInserts = expenseCategories.map((cat) => ({
          user_id: user.id,
          name: cat.name,
          type: (cat.type === 'need' ? 'fixed' : cat.type === 'want' ? 'variable' : 'bill') as 'fixed' | 'variable' | 'bill',
          budget_limit: cat.amount,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: createdCategories, error: categoryError } = await (supabase.from('expense_categories') as any)
          .insert(categoryInserts)
          .select();

        if (categoryError) throw categoryError;

        // Create expenses with budget limits
        const expenseInserts = expenseCategories.map((cat, index) => ({
          user_id: user.id,
          category_id: createdCategories?.[index]?.id || null,
          name: cat.name,
          amount: cat.amount,
          type: cat.categoryType as 'fixed' | 'variable',
          is_recurring: true,
          frequency: 'monthly' as const,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: expenseError } = await (supabase.from('expenses') as any).insert(expenseInserts);

        if (expenseError) throw expenseError;
      }

      // Create savings goals
      const savingsCategories = categories.filter((cat) => cat.isSavingsGoal);
      const savingsInserts = savingsCategories.map((cat) => ({
        user_id: user.id,
        name: cat.name,
        type: (cat.name.toLowerCase().includes('emergency') ? 'emergency_fund' : 'other') as 'emergency_fund' | 'vacation' | 'big_purchase' | 'retirement' | 'debt_payoff' | 'other',
        target_amount: cat.amount * 12, // Set target as 1 year of contributions
        current_amount: 0,
        monthly_contribution: cat.amount,
      }));

      if (savingsInserts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: savingsError } = await (supabase.from('savings_goals') as any).insert(savingsInserts);
        if (savingsError) throw savingsError;
      }

      // Update profile to mark onboarding as completed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          monthly_income_last_updated: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Success - call onComplete
      onComplete();
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();
  const isOverBudget = totals.total > 100;
  const isUnderBudget = totals.total < 80;

  const renderCategorySection = (
    title: string,
    type: 'need' | 'want' | 'saving',
    Icon: React.ElementType,
    colorClass: string
  ) => {
    const sectionCategories = categories.filter((cat) => cat.type === type);
    const sectionTotal = sectionCategories.reduce((sum, cat) => sum + cat.percentage, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-black dark:text-white" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <span className={`text-sm font-medium ${colorClass}`}>
              {sectionTotal.toFixed(1)}%
            </span>
          </div>
          <button
            onClick={() => addCategory(type)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            + Add
          </button>
        </div>

        <div className="space-y-3">
          {sectionCategories.map((cat, index) => {
            const globalIndex = categories.indexOf(cat);
            return (
              <div key={globalIndex} className="flex items-center gap-3">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => updateCategory(globalIndex, { name: e.target.value })}
                  placeholder="Category name"
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">€</span>
                  <input
                    type="number"
                    value={cat.amount.toFixed(0)}
                    onChange={(e) =>
                      updateCategory(globalIndex, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
                {sectionCategories.length > 1 && (
                  <button
                    onClick={() => removeCategory(globalIndex)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Create Your Budget
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          We've suggested a 50/30/20 budget based on your income of €{totalIncome.toFixed(2)}.
          Adjust the amounts to fit your needs.
        </p>
      </div>

      {/* Budget Sections */}
      <div className="space-y-6">
        {renderCategorySection(
          'Needs (Essential Expenses)',
          'need',
          Home,
          'text-black dark:text-white'
        )}
        {renderCategorySection(
          'Wants (Lifestyle Expenses)',
          'want',
          Target,
          'text-black dark:text-white'
        )}
        {renderCategorySection(
          'Savings (Future Goals)',
          'saving',
          PiggyBank,
          'text-black dark:text-white'
        )}
      </div>

      {/* Summary */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Total Allocated</span>
          <span
            className={`font-semibold ${
              isOverBudget
                ? 'text-red-600 dark:text-red-400'
                : isUnderBudget
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-green-600 dark:text-green-400'
            }`}
          >
            {totals.total.toFixed(1)}%
          </span>
        </div>
        {isOverBudget && (
          <p className="text-sm text-red-600 dark:text-red-400">
            You're over budget by {(totals.total - 100).toFixed(1)}%. Please reduce some amounts.
          </p>
        )}
        {isUnderBudget && (
          <p className="text-sm text-orange-600 dark:text-orange-400">
            You have {(100 - totals.total).toFixed(1)}% unallocated. Consider adding to savings or
            expenses.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isOverBudget}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Completing...
            </>
          ) : (
            'Complete Setup'
          )}
        </button>
      </div>
    </div>
  );
}
