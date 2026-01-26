'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Target, PiggyBank } from 'lucide-react';

interface MonthlyIncomeUpdateProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface CurrentIncome {
  salary: number | null;
  apl: number;
  primeActivite: number;
}

interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
  type: 'need' | 'want' | 'saving';
  categoryType: 'fixed' | 'variable';
  isSavingsGoal?: boolean;
  existingId?: string; // Track existing expense/savings goal ID
}

export function MonthlyIncomeUpdate({ isOpen, onClose, onUpdate }: MonthlyIncomeUpdateProps) {
  const [activeTab, setActiveTab] = useState<'paycheck' | 'benefits' | 'budget'>('paycheck');
  const [currentIncome, setCurrentIncome] = useState<CurrentIncome>({
    salary: null,
    apl: 0,
    primeActivite: 0,
  });
  const [newSalary, setNewSalary] = useState<number | null>(null);
  const [newApl, setNewApl] = useState(0);
  const [newPrimeActivite, setNewPrimeActivite] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Budget allocation state
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);

  // Month and year selection - default to current month
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const yearOptions = [
    currentDate.getFullYear(),
    currentDate.getFullYear() - 1,
    currentDate.getFullYear() - 2,
  ];

  // Load current income when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCurrentIncome();
      loadBudgetAllocations();
    }
  }, [isOpen]);

  // Reload budget when tab changes to budget or income changes
  useEffect(() => {
    if (activeTab === 'budget' && isOpen) {
      loadBudgetAllocations();
    }
  }, [activeTab, newSalary, newApl, newPrimeActivite]);

  const loadCurrentIncome = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: incomeSources } = await (supabase
        .from('income_sources')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true) as any);

      if (incomeSources) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salary = incomeSources.find((s: any) => s.type === 'salary');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apl = incomeSources.find((s: any) => s.type === 'apl');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prime = incomeSources.find((s: any) => s.type === 'prime_activite');

        setCurrentIncome({
          salary: salary?.amount || null,
          apl: apl?.amount || 0,
          primeActivite: prime?.amount || 0,
        });

        setNewApl(apl?.amount || 0);
        setNewPrimeActivite(prime?.amount || 0);
      }
    } catch (error) {
      console.error('Error loading current income:', error);
    }
  };

  const loadBudgetAllocations = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;

      if (totalIncome === 0) return;

      // Load existing expenses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingExpenses } = await (supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true) as any);

      // Load existing savings goals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingSavings } = await (supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true) as any);

      const initialCategories: BudgetCategory[] = [];

      // Convert existing expenses to budget categories
      if (existingExpenses && existingExpenses.length > 0) {
        existingExpenses.forEach((expense: any) => {
          initialCategories.push({
            name: expense.name,
            amount: expense.amount || 0,
            percentage: totalIncome > 0 ? ((expense.amount || 0) / totalIncome) * 100 : 0,
            type: expense.type === 'fixed' ? 'need' : 'want',
            categoryType: expense.type,
            isSavingsGoal: false,
            existingId: expense.id,
          });
        });
      }

      // Add existing savings goals
      if (existingSavings && existingSavings.length > 0) {
        existingSavings.forEach((saving: any) => {
          initialCategories.push({
            name: saving.name,
            amount: saving.monthly_contribution || 0,
            percentage: totalIncome > 0 ? ((saving.monthly_contribution || 0) / totalIncome) * 100 : 0,
            type: 'saving',
            categoryType: 'variable',
            isSavingsGoal: true,
            existingId: saving.id,
          });
        });
      }

      setBudgetCategories(initialCategories);
    } catch (error) {
      console.error('Error loading budget allocations:', error);
    }
  };

  const updateBudgetCategory = (index: number, updates: Partial<BudgetCategory>) => {
    setBudgetCategories((prev) =>
      prev.map((cat, i) => {
        if (i === index) {
          const updated = { ...cat, ...updates };
          const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;

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

  const addBudgetCategory = (type: 'need' | 'want' | 'saving') => {
    const newCategory: BudgetCategory = {
      name: '',
      amount: 0,
      percentage: 0,
      type,
      categoryType: type === 'need' ? 'fixed' : 'variable',
      isSavingsGoal: type === 'saving',
    };
    setBudgetCategories((prev) => [...prev, newCategory]);
  };

  const removeBudgetCategory = (index: number) => {
    setBudgetCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateBudgetTotals = () => {
    const byType = {
      need: 0,
      want: 0,
      saving: 0,
    };

    budgetCategories.forEach((cat) => {
      byType[cat.type] += cat.percentage;
    });

    const total = byType.need + byType.want + byType.saving;

    return { byType, total };
  };

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('month', selectedMonth.toString());
      formData.append('year', selectedYear.toString());

      const response = await fetch('/api/upload-paycheck', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      if (result.parsedData?.netSalary) {
        setNewSalary(result.parsedData.netSalary);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload paycheck');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        handleFileSelect(file);
      } else {
        setUploadError('Please upload a PDF file');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      // Update salary if changed
      if (newSalary !== null && newSalary !== currentIncome.salary) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingSalary } = await (supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'salary')
          .eq('is_active', true)
          .single() as any);

        if (existingSalary) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase
            .from('income_sources') as any)
            .update({ amount: newSalary, updated_at: new Date().toISOString() })
            .eq('id', existingSalary.id);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('income_sources') as any).insert({
            user_id: user.id,
            name: 'Monthly Salary',
            type: 'salary',
            amount: newSalary,
            frequency: 'monthly',
          });
        }
      }

      // Update APL if changed
      if (newApl !== currentIncome.apl) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingApl } = await (supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'apl')
          .eq('is_active', true)
          .single() as any);

        if (newApl > 0) {
          if (existingApl) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase
              .from('income_sources') as any)
              .update({ amount: newApl, updated_at: new Date().toISOString() })
              .eq('id', existingApl.id);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('income_sources') as any).insert({
              user_id: user.id,
              name: 'APL',
              type: 'apl',
              amount: newApl,
              frequency: 'monthly',
            });
          }
        } else if (existingApl) {
          // If set to 0, deactivate
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('income_sources') as any).update({ is_active: false }).eq('id', existingApl.id);
        }
      }

      // Update Prime d'Activité if changed
      if (newPrimeActivite !== currentIncome.primeActivite) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingPrime } = await (supabase
          .from('income_sources')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'prime_activite')
          .eq('is_active', true)
          .single() as any);

        if (newPrimeActivite > 0) {
          if (existingPrime) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase
              .from('income_sources') as any)
              .update({ amount: newPrimeActivite, updated_at: new Date().toISOString() })
              .eq('id', existingPrime.id);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('income_sources') as any).insert({
              user_id: user.id,
              name: 'Prime d\'Activité',
              type: 'prime_activite',
              amount: newPrimeActivite,
              frequency: 'monthly',
            });
          }
        } else if (existingPrime) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase
            .from('income_sources') as any)
            .update({ is_active: false })
            .eq('id', existingPrime.id);
        }
      }

      // Update budget allocations for each category
      for (const cat of budgetCategories) {
        if (cat.isSavingsGoal && cat.existingId) {
          // Update existing savings goal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase
            .from('savings_goals') as any)
            .update({ monthly_contribution: cat.amount, name: cat.name })
            .eq('id', cat.existingId);
        } else if (cat.isSavingsGoal && !cat.existingId && cat.name.trim()) {
          // Create new savings goal from budget allocation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('savings_goals') as any).insert({
            user_id: user.id,
            name: cat.name,
            type: 'other',
            target_amount: cat.amount * 12, // Default target: 1 year of contributions
            current_amount: 0,
            monthly_contribution: cat.amount,
            priority: 10,
          });
        } else if (!cat.isSavingsGoal && cat.existingId) {
          // Update expense amount
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase
            .from('expenses') as any)
            .update({ amount: cat.amount, name: cat.name })
            .eq('id', cat.existingId);
        } else if (!cat.isSavingsGoal && !cat.existingId && cat.name.trim()) {
          // Create new expense from budget allocation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('expenses') as any).insert({
            user_id: user.id,
            name: cat.name,
            amount: cat.amount,
            type: cat.categoryType,
            is_recurring: true,
            frequency: 'monthly',
          });
          if (error) console.error('Error creating expense:', error);
        }
      }

      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase
        .from('profiles') as any)
        .update({ monthly_income_last_updated: new Date().toISOString() })
        .eq('id', user.id);

      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving income:', error);
      setUploadError('Failed to save income updates');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const salaryDifference =
    newSalary !== null && currentIncome.salary !== null
      ? newSalary - currentIncome.salary
      : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Update Monthly Income
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('paycheck')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'paycheck'
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Paycheck
          </button>
          <button
            onClick={() => setActiveTab('benefits')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'benefits'
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Benefits
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'budget'
                ? 'border-b-2 border-black dark:border-white text-black dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Budget
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'budget' ? (
            <div className="space-y-6">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">New Total Monthly Income</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  €{((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite).toFixed(2)}
                </p>
              </div>

              {/* Remaining to Allocate */}
              {(() => {
                const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
                const totalAllocated = budgetCategories.reduce((sum, cat) => sum + cat.amount, 0);
                const remaining = totalIncome - totalAllocated;
                const remainingPercentage = totalIncome > 0 ? (remaining / totalIncome) * 100 : 0;

                return (
                  <div className={`rounded-lg p-4 border-2 ${
                    remaining < 0
                      ? 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800'
                      : remaining > totalIncome * 0.2
                        ? 'bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-800'
                        : 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800'
                  }`}>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Remaining to be allocated</p>
                    <div className="flex items-end gap-3">
                      <p className={`text-2xl font-bold ${
                        remaining < 0
                          ? 'text-red-700 dark:text-red-300'
                          : remaining > totalIncome * 0.2
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-green-700 dark:text-green-300'
                      }`}>
                        €{remaining.toFixed(2)}
                      </p>
                      <p className={`text-lg font-semibold mb-0.5 ${
                        remaining < 0
                          ? 'text-red-600 dark:text-red-400'
                          : remaining > totalIncome * 0.2
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}>
                        {remainingPercentage.toFixed(1)}%
                      </p>
                    </div>
                    {remaining < 0 && (
                      <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                        You're over budget by €{Math.abs(remaining).toFixed(2)}. Please reduce some allocations.
                      </p>
                    )}
                    {remaining > totalIncome * 0.2 && remaining >= 0 && (
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                        You have a large amount unallocated. Consider adding to expenses or savings.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Budget Sections */}
              <>
                {/* Needs Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-black dark:text-white" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Needs (Essential Expenses)
                      </h3>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        €{budgetCategories
                          .filter((cat) => cat.type === 'need')
                          .reduce((sum, cat) => sum + cat.amount, 0)
                          .toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {budgetCategories
                          .filter((cat) => cat.type === 'need')
                          .reduce((sum, cat) => sum + cat.percentage, 0)
                          .toFixed(1)}
                        %
                      </span>
                    </div>
                    <button
                      onClick={() => addBudgetCategory('need')}
                      className="text-sm text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {budgetCategories.filter((cat) => cat.type === 'need').length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic px-3 py-2">
                        No essential expenses yet. Click "+ Add" to add rent, utilities, insurance, etc.
                      </p>
                    ) : (
                      budgetCategories.map((cat, index) => {
                        if (cat.type !== 'need') return null;
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <input
                              type="text"
                              value={cat.name}
                              onChange={(e) => updateBudgetCategory(index, { name: e.target.value })}
                              placeholder="Category name"
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 dark:text-slate-400">€</span>
                              <input
                                type="number"
                                value={cat.amount.toFixed(0)}
                                onChange={(e) =>
                                  updateBudgetCategory(index, { amount: parseFloat(e.target.value) || 0 })
                                }
                                className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <button
                              onClick={() => removeBudgetCategory(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Wants Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-black dark:text-white" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Wants (Lifestyle Expenses)
                      </h3>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        €{budgetCategories
                          .filter((cat) => cat.type === 'want')
                          .reduce((sum, cat) => sum + cat.amount, 0)
                          .toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {budgetCategories
                          .filter((cat) => cat.type === 'want')
                          .reduce((sum, cat) => sum + cat.percentage, 0)
                          .toFixed(1)}
                        %
                      </span>
                    </div>
                    <button
                      onClick={() => addBudgetCategory('want')}
                      className="text-sm text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {budgetCategories.filter((cat) => cat.type === 'want').length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic px-3 py-2">
                        No lifestyle expenses yet. Click "+ Add" to add groceries, shopping, entertainment, etc.
                      </p>
                    ) : (
                      budgetCategories.map((cat, index) => {
                        if (cat.type !== 'want') return null;
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <input
                              type="text"
                              value={cat.name}
                              onChange={(e) => updateBudgetCategory(index, { name: e.target.value })}
                              placeholder="Category name"
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 dark:text-slate-400">€</span>
                              <input
                                type="number"
                                value={cat.amount.toFixed(0)}
                                onChange={(e) =>
                                  updateBudgetCategory(index, { amount: parseFloat(e.target.value) || 0 })
                                }
                                className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <button
                              onClick={() => removeBudgetCategory(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Savings Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-5 w-5 text-black dark:text-white" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Savings (Future Goals)
                      </h3>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        €{budgetCategories
                          .filter((cat) => cat.type === 'saving')
                          .reduce((sum, cat) => sum + cat.amount, 0)
                          .toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {budgetCategories
                          .filter((cat) => cat.type === 'saving')
                          .reduce((sum, cat) => sum + cat.percentage, 0)
                          .toFixed(1)}
                        %
                      </span>
                    </div>
                    <button
                      onClick={() => addBudgetCategory('saving')}
                      className="text-sm text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {budgetCategories.filter((cat) => cat.type === 'saving').length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic px-3 py-2">
                        No savings goals yet. Click "+ Add" to add emergency fund, projects, etc.
                      </p>
                    ) : (
                      budgetCategories.map((cat, index) => {
                        if (cat.type !== 'saving') return null;
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <input
                              type="text"
                              value={cat.name}
                              onChange={(e) => updateBudgetCategory(index, { name: e.target.value })}
                              placeholder="Category name"
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 dark:text-slate-400">€</span>
                              <input
                                type="number"
                                value={cat.amount.toFixed(0)}
                                onChange={(e) =>
                                  updateBudgetCategory(index, { amount: parseFloat(e.target.value) || 0 })
                                }
                                className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400 w-12">
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <button
                              onClick={() => removeBudgetCategory(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Total Allocated</span>
                    <span
                      className={`font-semibold ${
                        calculateBudgetTotals().total > 100
                          ? 'text-red-600 dark:text-red-400'
                          : calculateBudgetTotals().total < 80
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {calculateBudgetTotals().total.toFixed(1)}%
                    </span>
                  </div>
                  {calculateBudgetTotals().total > 100 && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      You're over budget by {(calculateBudgetTotals().total - 100).toFixed(1)}%.
                    </p>
                  )}
                  {calculateBudgetTotals().total < 80 && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      You have {(100 - calculateBudgetTotals().total).toFixed(1)}% unallocated.
                    </p>
                  )}
                </div>
              </>
            </div>
          ) : activeTab === 'paycheck' ? (
            <div className="space-y-6">
              {/* Month and Year Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-black dark:border-white bg-slate-50 dark:bg-slate-900'
                    : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {isUploading ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600 dark:text-slate-400">Analyzing paycheck...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-4xl">📄</div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Upload new paycheck
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">PDF only, max 5MB</p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-800 dark:text-red-200 text-sm">{uploadError}</p>
                </div>
              )}

              {currentIncome.salary !== null && (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Current salary</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    €{currentIncome.salary.toFixed(2)}
                  </p>
                </div>
              )}

              {newSalary !== null && (
                <div className="bg-slate-100 dark:bg-slate-800 border-2 border-black dark:border-white rounded-lg p-4 space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">New salary</p>
                  <div className="flex items-end gap-3">
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      €{newSalary.toFixed(2)}
                    </p>
                    {salaryDifference !== null && (
                      <p
                        className={`text-lg font-semibold ${
                          salaryDifference > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {salaryDifference > 0 ? '+' : ''}€{salaryDifference.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    APL (Housing Aid)
                  </label>
                  <input
                    type="number"
                    value={newApl}
                    onChange={(e) => setNewApl(parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  {newApl !== currentIncome.apl && (
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Changed from €{currentIncome.apl.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Prime d'Activité (Activity Bonus)
                  </label>
                  <input
                    type="number"
                    value={newPrimeActivite}
                    onChange={(e) => setNewPrimeActivite(parseFloat(e.target.value) || 0)}
                    min="0"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  {newPrimeActivite !== currentIncome.primeActivite && (
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Changed from €{currentIncome.primeActivite.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {activeTab === 'paycheck' && (newSalary !== null || newApl !== currentIncome.apl || newPrimeActivite !== currentIncome.primeActivite) && (
              <button
                onClick={() => setActiveTab('benefits')}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold rounded-lg transition-colors"
              >
                Next
              </button>
            )}
            {activeTab === 'benefits' && (
              <button
                onClick={() => setActiveTab('budget')}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold rounded-lg transition-colors"
              >
                Review Budget
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || (activeTab === 'budget' && calculateBudgetTotals().total > 100)}
              className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
