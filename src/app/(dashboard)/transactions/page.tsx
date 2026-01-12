'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Filter } from 'lucide-react';
import type { Tables } from '@/types/database';

type Transaction = Tables<'transactions'>;

const transactionTypes = [
  { value: 'expense', label: 'Expense', icon: ArrowDownCircle, color: 'text-red-600' },
  { value: 'income', label: 'Income', icon: ArrowUpCircle, color: 'text-green-600' },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-blue-600' },
];

const categories = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Gas',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Personal Care',
  'Education',
  'Travel',
  'Subscriptions',
  'Home',
  'Gifts',
  'Income',
  'Other',
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const supabase = createClient();

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<string>('expense');
  const [category, setCategory] = useState<string>('Other');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [merchant, setMerchant] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [filterMonth]);

  async function fetchTransactions() {
    setLoading(true);
    const [year, month] = filterMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false }) as any);

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const transactionData = {
      description,
      amount: parseFloat(amount),
      type,
      category,
      date,
      merchant: merchant || null,
    };

    if (editingTransaction) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('transactions') as any)
        .update(transactionData)
        .eq('id', editingTransaction.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('transactions') as any).insert({
        user_id: user.id,
        ...transactionData,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchTransactions();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any)
      .delete()
      .eq('id', id);
    fetchTransactions();
  }

  function openEditDialog(transaction: Transaction) {
    setEditingTransaction(transaction);
    setDescription(transaction.description);
    setAmount(transaction.amount.toString());
    setType(transaction.type);
    setCategory(transaction.category);
    setDate(transaction.date);
    setMerchant(transaction.merchant || '');
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingTransaction(null);
    setDescription('');
    setAmount('');
    setType('expense');
    setCategory('Other');
    setDate(new Date().toISOString().split('T')[0]);
    setMerchant('');
  }

  function getFilteredTransactions(): Transaction[] {
    if (filterCategory === 'all') return transactions;
    return transactions.filter((t) => t.category === filterCategory);
  }

  function calculateTotals() {
    const filtered = getFilteredTransactions();
    const expenses = filtered.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const income = filtered.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    return { expenses, income, net: income - expenses };
  }

  function groupByDate(txns: Transaction[]): Record<string, Transaction[]> {
    return txns.reduce((groups, txn) => {
      const date = txn.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(txn);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function getMonthOptions() {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }

  const totals = calculateTotals();
  const grouped = groupByDate(getFilteredTransactions());
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Track your individual purchases and income</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransaction ? 'Edit' : 'Add'} Transaction</DialogTitle>
              <DialogDescription>
                {editingTransaction ? 'Update transaction details.' : 'Record a new transaction.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Coffee at Starbucks"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
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
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant (Optional)</Label>
                <Input
                  id="merchant"
                  placeholder="e.g., Amazon, Walmart"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingTransaction ? 'Update' : 'Add'} Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-red-600">
              -${totals.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-green-600">
              +${totals.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold tracking-tight ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.net >= 0 ? '+' : '-'}${Math.abs(totals.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ArrowDownCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No transactions this month.</p>
            <p className="text-sm text-muted-foreground">Add your first transaction to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{formatDate(dateKey)}</h3>
              <div className="space-y-2">
                {grouped[dateKey].map((transaction) => {
                  const typeInfo = transactionTypes.find((t) => t.value === transaction.type);
                  const Icon = typeInfo?.icon || ArrowDownCircle;
                  return (
                    <Card key={transaction.id}>
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full bg-black/5 flex items-center justify-center ${typeInfo?.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category}
                              {transaction.merchant && ` • ${transaction.merchant}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-semibold ${transaction.type === 'expense' ? 'text-red-600' : transaction.type === 'income' ? 'text-green-600' : 'text-blue-600'}`}>
                              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
                              ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(transaction)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
