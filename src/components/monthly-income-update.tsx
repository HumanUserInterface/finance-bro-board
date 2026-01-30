'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Target, PiggyBank, CreditCard, Copy, Sparkles } from 'lucide-react';
import type { MonthlyBudgetWant, MonthlyBudgetSaving } from '@/types/database';

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
  existingId?: string; // Track existing savings_goal ID for linking
}

interface MonthlyBudgetRecord {
  id: string;
  wants: MonthlyBudgetWant[];
  savings: MonthlyBudgetSaving[];
  total_income: number | null;
  copied_from_month: string | null;
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Budget allocation state
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<{ id: string; isSavingsGoal: boolean }[]>([]);
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0); // Total for all subscriptions (not editable)
  const [billsTotal, setBillsTotal] = useState(0); // Total for all bills (not editable)

  // Monthly budget state
  const [monthlyBudgetRecord, setMonthlyBudgetRecord] = useState<MonthlyBudgetRecord | null>(null);
  const [hasBudgetForMonth, setHasBudgetForMonth] = useState(false);
  const [previousMonthBudget, setPreviousMonthBudget] = useState<MonthlyBudgetRecord | null>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);

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

  // Helper to get month date string (YYYY-MM-01)
  const getMonthDateString = useCallback((month: number, year: number) => {
    return `${year}-${month.toString().padStart(2, '0')}-01`;
  }, []);

  // Get previous month info
  const getPreviousMonth = useCallback((month: number, year: number) => {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }
    return { month: month - 1, year };
  }, []);

  // Load current income when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadCurrentIncome();
      setDeletedCategories([]); // Reset deleted items when dialog opens
    }
  }, [isOpen]);

  // Load monthly budget when month/year changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      loadMonthlyBudget();
    }
  }, [isOpen, selectedMonth, selectedYear]);

  // Reload subscriptions/bills when tab changes to budget
  useEffect(() => {
    if (activeTab === 'budget' && isOpen) {
      loadSubscriptionsAndBills();
    }
  }, [activeTab, isOpen]);

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

  // Subscription categories from the subscriptions module
  const SUBSCRIPTION_CATEGORIES = [
    'streaming', 'music', 'ai_tools', 'software', 'gaming',
    'cloud_storage', 'news_media', 'mobile_apps', 'other'
  ];

  // Helper to check if an expense is a subscription (has subscription category in notes)
  const isSubscription = (expense: any): boolean => {
    if (!expense.notes) return false;
    const match = expense.notes.match(/Category: (\w+)/);
    if (!match) return false;
    return SUBSCRIPTION_CATEGORIES.includes(match[1]);
  };

  // Calculate subscription monthly equivalent
  const getSubscriptionMonthlyAmount = (expense: any): number => {
    const multipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
    };
    const amount = expense.amount || 0;
    const frequency = expense.frequency || 'monthly';
    return amount * (multipliers[frequency] || 1);
  };

  // Load monthly budget for the selected month
  const loadMonthlyBudget = async () => {
    setIsLoadingBudget(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const monthDate = getMonthDateString(selectedMonth, selectedYear);

      // Load budget for selected month
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: monthlyBudget } = await (supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_date', monthDate)
        .single() as any);

      if (monthlyBudget) {
        setHasBudgetForMonth(true);
        setMonthlyBudgetRecord({
          id: monthlyBudget.id,
          wants: (monthlyBudget.wants || []) as MonthlyBudgetWant[],
          savings: (monthlyBudget.savings || []) as MonthlyBudgetSaving[],
          total_income: monthlyBudget.total_income,
          copied_from_month: monthlyBudget.copied_from_month,
        });

        // Convert to budget categories for UI
        const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
        const categories: BudgetCategory[] = [];

        // Add wants
        ((monthlyBudget.wants || []) as MonthlyBudgetWant[]).forEach((want: MonthlyBudgetWant) => {
          categories.push({
            name: want.name,
            amount: want.amount,
            percentage: totalIncome > 0 ? (want.amount / totalIncome) * 100 : 0,
            type: 'want',
            categoryType: 'variable',
            isSavingsGoal: false,
          });
        });

        // Add savings
        ((monthlyBudget.savings || []) as MonthlyBudgetSaving[]).forEach((saving: MonthlyBudgetSaving) => {
          categories.push({
            name: saving.name,
            amount: saving.amount,
            percentage: totalIncome > 0 ? (saving.amount / totalIncome) * 100 : 0,
            type: 'saving',
            categoryType: 'variable',
            isSavingsGoal: true,
            existingId: saving.savings_goal_id,
          });
        });

        setBudgetCategories(categories);
      } else {
        setHasBudgetForMonth(false);
        setMonthlyBudgetRecord(null);
        setBudgetCategories([]);
      }

      // Load previous month's budget to offer copy option
      const prev = getPreviousMonth(selectedMonth, selectedYear);
      const prevMonthDate = getMonthDateString(prev.month, prev.year);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prevBudget } = await (supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_date', prevMonthDate)
        .single() as any);

      if (prevBudget) {
        setPreviousMonthBudget({
          id: prevBudget.id,
          wants: (prevBudget.wants || []) as MonthlyBudgetWant[],
          savings: (prevBudget.savings || []) as MonthlyBudgetSaving[],
          total_income: prevBudget.total_income,
          copied_from_month: prevBudget.copied_from_month,
        });
      } else {
        setPreviousMonthBudget(null);
      }
    } catch (error) {
      console.error('Error loading monthly budget:', error);
    } finally {
      setIsLoadingBudget(false);
    }
  };

  // Load subscriptions and bills totals (read-only, managed elsewhere)
  const loadSubscriptionsAndBills = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Load existing expenses (subscriptions)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingExpenses } = await (supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true) as any);

      // Load existing bills from the bills table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingBills } = await (supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true) as any);

      let subsTotal = 0;

      // Calculate subscriptions total
      if (existingExpenses && existingExpenses.length > 0) {
        existingExpenses.forEach((expense: any) => {
          if (isSubscription(expense)) {
            subsTotal += getSubscriptionMonthlyAmount(expense);
          }
        });
      }

      setSubscriptionsTotal(subsTotal);

      // Calculate bills total from the bills table (read-only, managed in Bills page)
      let billsSum = 0;
      if (existingBills && existingBills.length > 0) {
        existingBills.forEach((bill: any) => {
          const multipliers: Record<string, number> = {
            weekly: 4.33,
            biweekly: 2.17,
            monthly: 1,
            quarterly: 0.33,
            annually: 0.083,
          };
          billsSum += (bill.amount || 0) * (multipliers[bill.frequency || 'monthly'] || 1);
        });
      }
      setBillsTotal(billsSum);
    } catch (error) {
      console.error('Error loading subscriptions and bills:', error);
    }
  };

  // Copy budget from previous month
  const copyFromPreviousMonth = () => {
    if (!previousMonthBudget) return;

    const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
    const categories: BudgetCategory[] = [];

    // Copy wants
    previousMonthBudget.wants.forEach((want) => {
      categories.push({
        name: want.name,
        amount: want.amount,
        percentage: totalIncome > 0 ? (want.amount / totalIncome) * 100 : 0,
        type: 'want',
        categoryType: 'variable',
        isSavingsGoal: false,
      });
    });

    // Copy savings
    previousMonthBudget.savings.forEach((saving) => {
      categories.push({
        name: saving.name,
        amount: saving.amount,
        percentage: totalIncome > 0 ? (saving.amount / totalIncome) * 100 : 0,
        type: 'saving',
        categoryType: 'variable',
        isSavingsGoal: true,
        existingId: saving.savings_goal_id,
      });
    });

    setBudgetCategories(categories);
    setHasBudgetForMonth(true); // Mark as having budget (will be created on save)
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
    const categoryToRemove = budgetCategories[index];
    // Track deletion if it has an existing ID (needs to be deleted from database)
    if (categoryToRemove?.existingId) {
      setDeletedCategories((prev) => [
        ...prev,
        { id: categoryToRemove.existingId!, isSavingsGoal: categoryToRemove.isSavingsGoal || false }
      ]);
    }
    setBudgetCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const applyAutoBudget = () => {
    const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
    if (totalIncome === 0) return;

    // Calculate available budget after subscriptions and bills
    const subscriptionsPercentage = totalIncome > 0 ? (subscriptionsTotal / totalIncome) * 100 : 0;
    const billsPercentage = totalIncome > 0 ? (billsTotal / totalIncome) * 100 : 0;
    const availableForBudget = 100 - subscriptionsPercentage - billsPercentage;

    // Split remaining budget between wants (60%) and savings (40%)
    // Bills and subscriptions are managed separately
    const wantsRatio = 0.60;
    const savingsRatio = 0.40;

    const adjustedWants = availableForBudget * wantsRatio;
    const adjustedSavings = availableForBudget * savingsRatio;

    // Auto budget for Wants and Savings only (bills/subscriptions managed separately)
    const autoBudget: BudgetCategory[] = [
      // Wants (60% of available after bills/subscriptions)
      { name: 'Groceries', amount: totalIncome * (adjustedWants * 0.50 / 100), percentage: adjustedWants * 0.50, type: 'want', categoryType: 'variable' },
      { name: 'Entertainment', amount: totalIncome * (adjustedWants * 0.17 / 100), percentage: adjustedWants * 0.17, type: 'want', categoryType: 'variable' },
      { name: 'Shopping', amount: totalIncome * (adjustedWants * 0.17 / 100), percentage: adjustedWants * 0.17, type: 'want', categoryType: 'variable' },
      { name: 'Dining Out', amount: totalIncome * (adjustedWants * 0.16 / 100), percentage: adjustedWants * 0.16, type: 'want', categoryType: 'variable' },
      // Savings (40% of available after bills/subscriptions)
      { name: 'Emergency Fund', amount: totalIncome * (adjustedSavings * 0.50 / 100), percentage: adjustedSavings * 0.50, type: 'saving', categoryType: 'variable', isSavingsGoal: true },
      { name: 'Projects', amount: totalIncome * (adjustedSavings * 0.50 / 100), percentage: adjustedSavings * 0.50, type: 'saving', categoryType: 'variable', isSavingsGoal: true },
    ];

    setBudgetCategories(autoBudget);
    setHasBudgetForMonth(true); // Mark as having budget (will be created on save)
  };

  const calculateBudgetTotals = () => {
    const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
    const subscriptionsPercentage = totalIncome > 0 ? (subscriptionsTotal / totalIncome) * 100 : 0;
    const billsPercentage = totalIncome > 0 ? (billsTotal / totalIncome) * 100 : 0;

    const byType = {
      need: 0,
      want: 0,
      saving: 0,
      subscriptions: subscriptionsPercentage,
      bills: billsPercentage,
    };

    budgetCategories.forEach((cat) => {
      byType[cat.type] += cat.percentage;
    });

    const total = byType.need + byType.want + byType.saving + byType.subscriptions + byType.bills;

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

      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Server returned non-JSON response:', contentType);
        throw new Error('Server error. Please check the console and try again.');
      }

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
    setSaveError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) throw new Error('Not authenticated');

      const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
      const monthDate = getMonthDateString(selectedMonth, selectedYear);

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
          const { error } = await (supabase
            .from('income_sources') as any)
            .update({ amount: newSalary, updated_at: new Date().toISOString() })
            .eq('id', existingSalary.id);
          if (error) throw new Error(`Failed to update salary: ${error.message}`);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('income_sources') as any).insert({
            user_id: user.id,
            name: 'Monthly Salary',
            type: 'salary',
            amount: newSalary,
            frequency: 'monthly',
            is_active: true,
          });
          if (error) throw new Error(`Failed to create salary: ${error.message}`);
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
            const { error } = await (supabase
              .from('income_sources') as any)
              .update({ amount: newApl, updated_at: new Date().toISOString() })
              .eq('id', existingApl.id);
            if (error) throw new Error(`Failed to update APL: ${error.message}`);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('income_sources') as any).insert({
              user_id: user.id,
              name: 'APL',
              type: 'apl',
              amount: newApl,
              frequency: 'monthly',
              is_active: true,
            });
            if (error) throw new Error(`Failed to create APL: ${error.message}`);
          }
        } else if (existingApl) {
          // If set to 0, deactivate
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('income_sources') as any).update({ is_active: false }).eq('id', existingApl.id);
          if (error) throw new Error(`Failed to deactivate APL: ${error.message}`);
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
            const { error } = await (supabase
              .from('income_sources') as any)
              .update({ amount: newPrimeActivite, updated_at: new Date().toISOString() })
              .eq('id', existingPrime.id);
            if (error) throw new Error(`Failed to update Prime d'Activité: ${error.message}`);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('income_sources') as any).insert({
              user_id: user.id,
              name: 'Prime d\'Activité',
              type: 'prime_activite',
              amount: newPrimeActivite,
              frequency: 'monthly',
              is_active: true,
            });
            if (error) throw new Error(`Failed to create Prime d'Activité: ${error.message}`);
          }
        } else if (existingPrime) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase
            .from('income_sources') as any)
            .update({ is_active: false })
            .eq('id', existingPrime.id);
          if (error) throw new Error(`Failed to deactivate Prime d'Activité: ${error.message}`);
        }
      }

      // Prepare budget data for monthly_budgets table
      const wantsData: MonthlyBudgetWant[] = budgetCategories
        .filter((cat) => cat.type === 'want' && cat.name.trim())
        .map((cat) => ({ name: cat.name, amount: cat.amount }));

      const savingsData: MonthlyBudgetSaving[] = budgetCategories
        .filter((cat) => cat.type === 'saving' && cat.name.trim())
        .map((cat) => ({
          name: cat.name,
          amount: cat.amount,
          savings_goal_id: cat.existingId,
        }));

      // Determine if we're copying from previous month
      const prev = getPreviousMonth(selectedMonth, selectedYear);
      const prevMonthDate = getMonthDateString(prev.month, prev.year);
      const copiedFromMonth = previousMonthBudget ? prevMonthDate : null;

      // Save to monthly_budgets table (upsert)
      if (budgetCategories.length > 0 || hasBudgetForMonth) {
        if (monthlyBudgetRecord?.id) {
          // Update existing record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase
            .from('monthly_budgets') as any)
            .update({
              wants: wantsData,
              savings: savingsData,
              total_income: totalIncome,
              updated_at: new Date().toISOString(),
            })
            .eq('id', monthlyBudgetRecord.id);
          if (error) throw new Error(`Failed to update monthly budget: ${error.message}`);
        } else {
          // Create new record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('monthly_budgets') as any).insert({
            user_id: user.id,
            month_date: monthDate,
            wants: wantsData,
            savings: savingsData,
            total_income: totalIncome,
            copied_from_month: copiedFromMonth,
          });
          if (error) throw new Error(`Failed to create monthly budget: ${error.message}`);
        }
      }

      // Also update savings_goals.monthly_contribution with the latest values
      // This keeps the savings goals table in sync for goal tracking purposes
      for (const cat of budgetCategories) {
        if (cat.isSavingsGoal && cat.existingId && cat.name.trim()) {
          // Update existing savings goal's monthly contribution
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase
            .from('savings_goals') as any)
            .update({ monthly_contribution: cat.amount })
            .eq('id', cat.existingId);
          if (error) console.warn(`Failed to sync savings goal "${cat.name}": ${error.message}`);
        } else if (cat.isSavingsGoal && !cat.existingId && cat.name.trim()) {
          // Create new savings goal for tracking
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from('savings_goals') as any).insert({
            user_id: user.id,
            name: cat.name,
            type: 'other',
            target_amount: cat.amount * 12,
            current_amount: 0,
            monthly_contribution: cat.amount,
            priority: 10,
            is_active: true,
          });
          if (error) console.warn(`Failed to create savings goal "${cat.name}": ${error.message}`);
        }
      }

      // Clear deleted categories after saving
      setDeletedCategories([]);

      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .update({ monthly_income_last_updated: new Date().toISOString() })
        .eq('id', user.id);
      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving income:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save income updates');
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
              {/* Month Header */}
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Budget for {MONTHS[selectedMonth - 1]} {selectedYear}
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  €{((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite).toFixed(2)}
                </p>
              </div>

              {/* Loading State */}
              {isLoadingBudget ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-slate-300 dark:border-slate-700 border-t-black dark:border-t-white rounded-full animate-spin" />
                </div>
              ) : !hasBudgetForMonth && budgetCategories.length === 0 ? (
                /* No Budget State */
                <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center space-y-4">
                  <div className="text-4xl">📋</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    No budget set for {MONTHS[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Set up your budget allocations for this month to track your spending.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    {previousMonthBudget && (
                      <button
                        onClick={copyFromPreviousMonth}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-900 dark:text-slate-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy from {MONTHS[getPreviousMonth(selectedMonth, selectedYear).month - 1]}
                      </button>
                    )}
                    <button
                      onClick={applyAutoBudget}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Start Fresh with Auto Budget
                    </button>
                  </div>
                </div>
              ) : (
                /* Budget Editor */
                <>
                  {/* Remaining to Allocate */}
                  {(() => {
                    const totalIncome = (newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite;
                    const totalAllocated = budgetCategories.reduce((sum, cat) => sum + cat.amount, 0) + subscriptionsTotal + billsTotal;
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

                  {/* Budget Action Buttons */}
                  <div className="flex justify-center gap-3">
                    {previousMonthBudget && (
                      <button
                        onClick={copyFromPreviousMonth}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                      >
                        <Copy className="h-4 w-4" />
                        Copy from {MONTHS[getPreviousMonth(selectedMonth, selectedYear).month - 1]}
                      </button>
                    )}
                    <button
                      onClick={applyAutoBudget}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <Sparkles className="h-4 w-4" />
                      Auto Budget
                    </button>
                  </div>
                {/* Subscriptions Total (read-only) */}
                {subscriptionsTotal > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-black dark:text-white" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          Subscriptions
                        </h3>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          €{subscriptionsTotal.toFixed(2)}
                        </span>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite) > 0
                            ? ((subscriptionsTotal / ((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite)) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <a
                        href="/budget/expenses"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Manage →
                      </a>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm text-slate-600 dark:text-slate-400">
                      Subscriptions are managed in the Expenses page. This total includes all active subscriptions for the current month.
                    </div>
                  </div>
                )}

                {/* Bills Total (read-only) */}
                {billsTotal > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-black dark:text-white" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          Bills
                        </h3>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          €{billsTotal.toFixed(2)}
                        </span>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite) > 0
                            ? ((billsTotal / ((newSalary || currentIncome.salary || 0) + newApl + newPrimeActivite)) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <a
                        href="/budget/bills"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Manage →
                      </a>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-sm text-slate-600 dark:text-slate-400">
                      Bills (rent, utilities, insurance) are managed in the Bills page.
                    </div>
                  </div>
                )}

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
              )}
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
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {saveError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-800 dark:text-red-200 text-sm">{saveError}</p>
            </div>
          )}
          <div className="flex justify-between gap-3">
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
    </div>
  );
}
