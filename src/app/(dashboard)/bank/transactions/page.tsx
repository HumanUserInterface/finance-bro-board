'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Filter, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  'Internal Transfer',
  'Other',
];

// Time period options
const timePeriods = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: '3-months', label: 'Last 3 Months' },
  { value: '6-months', label: 'Last 6 Months' },
  { value: 'this-year', label: 'This Year' },
  { value: '1-year', label: 'Last 12 Months' },
  { value: '2-years', label: 'Last 2 Years' },
  { value: 'all', label: 'All Time' },
];

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let startDate: string;

  switch (period) {
    case 'this-month':
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'last-month':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = lastMonth.toISOString().split('T')[0];
      break;
    case '3-months':
      const threeMonths = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      startDate = threeMonths.toISOString().split('T')[0];
      break;
    case '6-months':
      const sixMonths = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      startDate = sixMonths.toISOString().split('T')[0];
      break;
    case 'this-year':
      startDate = `${now.getFullYear()}-01-01`;
      break;
    case '1-year':
      const oneYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      startDate = oneYear.toISOString().split('T')[0];
      break;
    case '2-years':
      const twoYears = new Date(now.getFullYear() - 2, now.getMonth(), 1);
      startDate = twoYears.toISOString().split('T')[0];
      break;
    case 'all':
    default:
      startDate = '2000-01-01';
      break;
  }

  return { startDate, endDate };
}

export default function BankTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('6-months');
  const [showChart, setShowChart] = useState(true);
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
  }, [filterPeriod]);

  async function fetchTransactions() {
    setLoading(true);
    const { startDate, endDate } = getDateRange(filterPeriod);

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

  // Prepare chart data - aggregate by month
  const chartData = useMemo(() => {
    const monthlyData: Record<string, { month: string; income: number; expenses: number }> = {};

    transactions.forEach((tx) => {
      const monthKey = tx.date.substring(0, 7); // "YYYY-MM"
      if (!monthlyData[monthKey]) {
        const date = new Date(tx.date);
        monthlyData[monthKey] = {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          income: 0,
          expenses: 0,
        };
      }
      if (tx.type === 'income') {
        monthlyData[monthKey].income += tx.amount;
      } else if (tx.type === 'expense') {
        monthlyData[monthKey].expenses += tx.amount;
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);
  }, [transactions]);

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
    const transfers = filtered.filter((t) => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
    const transferCount = filtered.filter((t) => t.type === 'transfer').length;
    return { expenses, income, net: income - expenses, transfers, transferCount };
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

  const totals = calculateTotals();
  const grouped = groupByDate(getFilteredTransactions());
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">View and manage imported bank transactions</p>
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
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timePeriods.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
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
        <Button
          variant={showChart ? "default" : "outline"}
          size="sm"
          onClick={() => setShowChart(!showChart)}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          {showChart ? 'Hide Chart' : 'Show Chart'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-red-600">
              -€{totals.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-green-600">
              +€{totals.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-semibold tracking-tight ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.net >= 0 ? '+' : '-'}€{Math.abs(totals.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        {totals.transferCount > 0 && (
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-purple-500">Internal Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight text-purple-600">
                €{totals.transfers.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-purple-400 mt-1">{totals.transferCount} transfer{totals.transferCount !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Income/Expenses Line Chart */}
      {showChart && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `€${value}`} />
                  <Tooltip
                    formatter={(value) => [`€${Number(value).toFixed(2)}`, '']}
                    labelStyle={{ fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ fill: '#16a34a', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Income"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ArrowDownCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No transactions found.</p>
            <p className="text-sm text-muted-foreground">Import bank statements to see your transactions here.</p>
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
                            <p className="font-medium">
                              {transaction.description}
                              {transaction.type === 'transfer' && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                  Internal
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category}
                              {transaction.merchant && ` • ${transaction.merchant}`}
                              {transaction.type === 'transfer' && transaction.notes && (
                                <span className="text-purple-500 dark:text-purple-400">
                                  {' • '}{transaction.notes.replace('[Auto-fixed: internal transfer from Espace]', '').replace('[Auto-fixed: internal transfer to Espace]', '').trim()}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-semibold ${transaction.type === 'expense' ? 'text-red-600' : transaction.type === 'income' ? 'text-green-600' : 'text-purple-600'}`}>
                              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '↔'}
                              €{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
