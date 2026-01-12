'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Receipt, TrendingDown } from 'lucide-react';
import type { Tables } from '@/types/database';

type Expense = Tables<'expenses'>;
type ExpenseCategory = Tables<'expense_categories'>;

const expenseTypes = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'variable', label: 'Variable' },
];

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'one_time', label: 'One-time' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('variable');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [isRecurring, setIsRecurring] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [expensesRes, categoriesRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('expense_categories')
        .select('*')
        .order('name'),
    ]);

    if (!expensesRes.error && expensesRes.data) {
      setExpenses(expensesRes.data);
    }
    if (!categoriesRes.error && categoriesRes.data) {
      setCategories(categoriesRes.data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expenseData = {
      name,
      type,
      amount: parseFloat(amount),
      frequency: isRecurring ? frequency : 'one_time',
      is_recurring: isRecurring,
      category_id: categoryId || null,
    };

    if (editingExpense) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('expenses') as any)
        .update(expenseData)
        .eq('id', editingExpense.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('expenses') as any).insert({
        user_id: user.id,
        ...expenseData,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('expenses') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchData();
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense);
    setName(expense.name);
    setType(expense.type);
    setAmount(expense.amount.toString());
    setFrequency(expense.frequency || 'monthly');
    setIsRecurring(expense.is_recurring);
    setCategoryId(expense.category_id || '');
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingExpense(null);
    setName('');
    setType('variable');
    setAmount('');
    setFrequency('monthly');
    setIsRecurring(true);
    setCategoryId('');
  }

  function calculateMonthlyTotal(): number {
    return expenses.reduce((total, expense) => {
      if (!expense.is_recurring) return total;
      const multipliers: Record<string, number> = {
        weekly: 4.33,
        biweekly: 2.17,
        monthly: 1,
        quarterly: 0.33,
        annually: 0.083,
        one_time: 0,
      };
      return total + expense.amount * (multipliers[expense.frequency || 'monthly'] || 0);
    }, 0);
  }

  function getFixedTotal(): number {
    return expenses
      .filter((e) => e.type === 'fixed' && e.is_recurring)
      .reduce((total, expense) => {
        const multipliers: Record<string, number> = {
          weekly: 4.33,
          biweekly: 2.17,
          monthly: 1,
          quarterly: 0.33,
          annually: 0.083,
          one_time: 0,
        };
        return total + expense.amount * (multipliers[expense.frequency || 'monthly'] || 0);
      }, 0);
  }

  function getVariableTotal(): number {
    return expenses
      .filter((e) => e.type === 'variable' && e.is_recurring)
      .reduce((total, expense) => {
        const multipliers: Record<string, number> = {
          weekly: 4.33,
          biweekly: 2.17,
          monthly: 1,
          quarterly: 0.33,
          annually: 0.083,
          one_time: 0,
        };
        return total + expense.amount * (multipliers[expense.frequency || 'monthly'] || 0);
      }, 0);
  }

  function getCategoryName(categoryId: string | null): string {
    if (!categoryId) return 'Uncategorized';
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage your recurring expenses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit' : 'Add'} Expense</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Update your expense details.' : 'Add a new expense to track.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Rent, Groceries, Netflix"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="category">Category (Optional)</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <Label htmlFor="recurring">Recurring expense</Label>
              </div>
              {isRecurring && (
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencies.filter((f) => f.value !== 'one_time').map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">
                {editingExpense ? 'Update' : 'Add'} Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tracking-tight">
              ${calculateMonthlyTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-black/40 text-sm mt-1">
              From {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Fixed Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${getFixedTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-black/40 text-sm">per month</p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Variable Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${getVariableTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-black/40 text-sm">per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No expenses yet.</p>
            <p className="text-sm text-muted-foreground">Add your first expense to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-black/5 flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="font-medium">{expense.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {expenseTypes.find((t) => t.value === expense.type)?.label} &bull;{' '}
                      {expense.is_recurring
                        ? frequencies.find((f) => f.value === expense.frequency)?.label
                        : 'One-time'}
                      {expense.category_id && (
                        <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                          {getCategoryName(expense.category_id)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">
                      -${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(expense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
