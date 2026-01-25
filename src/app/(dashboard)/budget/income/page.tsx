'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, DollarSign, Upload } from 'lucide-react';
import type { Tables } from '@/types/database';
import { MonthlyIncomeUpdate } from '@/components/monthly-income-update';

type IncomeSource = Tables<'income_sources'>;

const incomeTypes = [
  { value: 'salary', label: 'Salary' },
  { value: 'side_income', label: 'Side Income' },
  { value: 'investments', label: 'Investments' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'apl', label: 'APL (Housing Aid)' },
  { value: 'prime_activite', label: 'Prime d\'Activité' },
  { value: 'other', label: 'Other' },
];

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'one_time', label: 'One-time' },
];

export default function IncomePage() {
  const [incomes, setIncomes] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('salary');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');

  useEffect(() => {
    fetchIncomes();
  }, []);

  async function fetchIncomes() {
    const { data, error } = await supabase
      .from('income_sources')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setIncomes(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingIncome) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('income_sources') as any)
        .update({
          name,
          type,
          amount: parseFloat(amount),
          frequency,
        })
        .eq('id', editingIncome.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('income_sources') as any).insert({
        user_id: user.id,
        name,
        type,
        amount: parseFloat(amount),
        frequency,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchIncomes();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('income_sources') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchIncomes();
  }

  function openEditDialog(income: IncomeSource) {
    setEditingIncome(income);
    setName(income.name);
    setType(income.type);
    setAmount(income.amount.toString());
    setFrequency(income.frequency);
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingIncome(null);
    setName('');
    setType('salary');
    setAmount('');
    setFrequency('monthly');
  }

  function calculateMonthlyTotal(): number {
    return incomes.reduce((total, income) => {
      const multipliers: Record<string, number> = {
        weekly: 4.33,
        biweekly: 2.17,
        monthly: 1,
        quarterly: 0.33,
        annually: 0.083,
        one_time: 0,
      };
      return total + income.amount * (multipliers[income.frequency] || 0);
    }, 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Sources</h1>
          <p className="text-muted-foreground">Manage your income streams</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUpdateDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Update Monthly Income
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Income
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIncome ? 'Edit' : 'Add'} Income Source</DialogTitle>
              <DialogDescription>
                {editingIncome ? 'Update your income source details.' : 'Add a new income source to track.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Main Job, Freelance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((t) => (
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
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                {editingIncome ? 'Update' : 'Add'} Income
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Monthly Total Card */}
      <Card className="border-black/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Monthly Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            ${calculateMonthlyTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-black/40 text-sm mt-1">
            From {incomes.length} source{incomes.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Income List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : incomes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No income sources yet.</p>
            <p className="text-sm text-muted-foreground">Add your first income source to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {incomes.map((income) => (
            <Card key={income.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-black/5 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="font-medium">{income.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {incomeTypes.find((t) => t.value === income.type)?.label} &bull;{' '}
                      {frequencies.find((f) => f.value === income.frequency)?.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">
                      ${income.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(income)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(income.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monthly Income Update Dialog */}
      <MonthlyIncomeUpdate
        isOpen={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        onUpdate={fetchIncomes}
      />
    </div>
  );
}
