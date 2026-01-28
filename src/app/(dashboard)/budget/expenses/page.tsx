'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Tv, Music, Cloud, Gamepad2, Brain, CreditCard, Globe, Smartphone, Calendar, List, Trash2 } from 'lucide-react';
import { SubscriptionMonthManager } from '@/components/subscriptions';
import type { SubscriptionWithMonthState } from '@/lib/services/subscription-months';
import { Card, CardContent } from '@/components/ui/card';
import type { Tables } from '@/types/database';

type Expense = Tables<'expenses'>;

// Subscription categories with icons
const subscriptionCategories = [
  { value: 'streaming', label: 'Streaming', icon: Tv, examples: 'Netflix, Disney+, Prime Video' },
  { value: 'music', label: 'Music', icon: Music, examples: 'Spotify, Apple Music, Deezer' },
  { value: 'ai_tools', label: 'AI Tools', icon: Brain, examples: 'ChatGPT, Claude, Midjourney' },
  { value: 'software', label: 'Software', icon: Cloud, examples: 'Adobe, Microsoft 365, Notion' },
  { value: 'gaming', label: 'Gaming', icon: Gamepad2, examples: 'PlayStation Plus, Xbox Game Pass' },
  { value: 'cloud_storage', label: 'Cloud Storage', icon: Cloud, examples: 'iCloud, Google One, Dropbox' },
  { value: 'news_media', label: 'News & Media', icon: Globe, examples: 'NYT, Medium, Substack' },
  { value: 'mobile_apps', label: 'Mobile Apps', icon: Smartphone, examples: 'Dating apps, Fitness apps' },
  { value: 'other', label: 'Other', icon: CreditCard, examples: 'Other subscriptions' },
];

const frequencies = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'weekly', label: 'Weekly' },
];

// Popular subscriptions for quick add
const popularSubscriptions = [
  { name: 'Netflix', category: 'streaming', amount: 15.99 },
  { name: 'Spotify', category: 'music', amount: 10.99 },
  { name: 'ChatGPT Plus', category: 'ai_tools', amount: 20 },
  { name: 'Claude Pro', category: 'ai_tools', amount: 20 },
  { name: 'Disney+', category: 'streaming', amount: 8.99 },
  { name: 'Amazon Prime', category: 'streaming', amount: 6.99 },
  { name: 'iCloud+', category: 'cloud_storage', amount: 2.99 },
  { name: 'YouTube Premium', category: 'streaming', amount: 12.99 },
  { name: 'Adobe CC', category: 'software', amount: 54.99 },
  { name: 'Microsoft 365', category: 'software', amount: 9.99 },
];

export default function ExpensesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('EUR');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('streaming');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [billingDay, setBillingDay] = useState('1');
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    async function getUserAndProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Fetch user's currency from profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase
          .from('profiles')
          .select('currency')
          .eq('id', user.id)
          .single() as any);
        if (profile?.currency) {
          setCurrency(profile.currency);
        }
      }
    }
    getUserAndProfile();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expenseData = {
      name,
      type: 'fixed' as const,
      amount: parseFloat(amount),
      frequency,
      is_recurring: true,
      category_id: null,
      notes: `Category: ${category}, Billing day: ${billingDay}`,
    };

    if (editingExpense) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('expenses') as any)
        .update({
          ...expenseData,
          start_date: `${startMonth}-01`,
        })
        .eq('id', editingExpense.id);
    } else {
      // Use user-specified start month
      const startDate = `${startMonth}-01`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('expenses') as any).insert({
        user_id: user.id,
        ...expenseData,
        start_date: startDate,
      });
    }

    resetForm();
    setDialogOpen(false);
    // Trigger refresh of the subscription manager
    setRefreshKey(prev => prev + 1);
  }

  function resetForm() {
    setEditingExpense(null);
    setName('');
    setCategory('streaming');
    setAmount('');
    setFrequency('monthly');
    setBillingDay('1');
    const now = new Date();
    setStartMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }

  function quickAddSubscription(sub: typeof popularSubscriptions[0]) {
    setName(sub.name);
    setCategory(sub.category);
    setAmount(sub.amount.toString());
    setFrequency('monthly');
  }

  function handleEditSubscription(subscription: SubscriptionWithMonthState) {
    setEditingExpense(subscription);
    setName(subscription.name);
    setAmount(subscription.amount.toString());
    setFrequency(subscription.frequency || 'monthly');

    // Parse category and billing day from notes
    const categoryMatch = subscription.notes?.match(/Category: (\w+)/);
    const billingDayMatch = subscription.notes?.match(/Billing day: (\d+)/);
    setCategory(categoryMatch?.[1] || 'other');
    setBillingDay(billingDayMatch?.[1] || '1');

    // Set start month from start_date
    if (subscription.start_date) {
      const [year, month] = subscription.start_date.split('-');
      setStartMonth(`${year}-${month}`);
    } else {
      const now = new Date();
      setStartMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }

    setDialogOpen(true);
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage your recurring subscriptions month by month</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit' : 'Add'} Subscription</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Update your subscription details.' : 'Track a new subscription service.'}
              </DialogDescription>
            </DialogHeader>

            {/* Quick Add Section */}
            {!editingExpense && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Add</Label>
                <div className="flex flex-wrap gap-2">
                  {popularSubscriptions.slice(0, 6).map((sub) => (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => quickAddSubscription(sub)}
                      className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Netflix, Spotify, ChatGPT"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionCategories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{cat.label}</span>
                            <span className="text-xs text-muted-foreground">({cat.examples})</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="9.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Billing Cycle</Label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Month</Label>
                  <div className="flex gap-2">
                    <Select
                      value={startMonth.split('-')[1]}
                      onValueChange={(month) => setStartMonth(`${startMonth.split('-')[0]}-${month}`)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: '01', label: 'January' },
                          { value: '02', label: 'February' },
                          { value: '03', label: 'March' },
                          { value: '04', label: 'April' },
                          { value: '05', label: 'May' },
                          { value: '06', label: 'June' },
                          { value: '07', label: 'July' },
                          { value: '08', label: 'August' },
                          { value: '09', label: 'September' },
                          { value: '10', label: 'October' },
                          { value: '11', label: 'November' },
                          { value: '12', label: 'December' },
                        ].map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={startMonth.split('-')[0]}
                      onValueChange={(year) => setStartMonth(`${year}-${startMonth.split('-')[1]}`)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 5 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">When did this subscription start?</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingDay">Billing Day</Label>
                  <Input
                    id="billingDay"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1"
                    value={billingDay}
                    onChange={(e) => setBillingDay(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Day of month you&apos;re billed</p>
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingExpense ? 'Update' : 'Add'} Subscription
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Monthly View
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <List className="h-4 w-4" />
            All Subscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <SubscriptionMonthManager
            key={refreshKey}
            userId={userId}
            currency={currency}
            onEditSubscription={handleEditSubscription}
          />
        </TabsContent>

        <TabsContent value="all">
          <AllSubscriptionsView
            userId={userId}
            currency={currency}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey(prev => prev + 1)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Currency symbols mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
};

// Simple all subscriptions view (base prices, not month-specific)
function AllSubscriptionsView({
  userId,
  currency = 'EUR',
  refreshKey,
  onRefresh
}: {
  userId: string;
  currency?: string;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const currencySymbol = currencySymbols[currency] || currency;

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  async function fetchData() {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_recurring', true)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false }) as any);

    if (!error && data) {
      setExpenses(data);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this subscription? It will be marked as inactive.')) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('expenses') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchData();
    onRefresh();
  }

  async function handleDeleteAll() {
    if (!confirm(`Delete all ${expenses.length} subscriptions? This cannot be undone.`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('expenses') as any)
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .eq('is_active', true);
    fetchData();
    onRefresh();
  }

  function getCategoryFromNotes(notes: string | null): string {
    if (!notes) return 'other';
    const match = notes.match(/Category: (\w+)/);
    return match?.[1] || 'other';
  }

  const categoryIcons: Record<string, React.ElementType> = {
    streaming: Tv,
    music: Music,
    ai_tools: Brain,
    software: Cloud,
    gaming: Gamepad2,
    cloud_storage: Cloud,
    news_media: Globe,
    mobile_apps: Smartphone,
    other: CreditCard,
  };

  function calculateMonthlyTotal(): number {
    return expenses.reduce((total, expense) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="border-black/10">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-black/40">Base Monthly Total</p>
              <p className="text-3xl font-semibold tracking-tight mt-1">
                {currencySymbol}{calculateMonthlyTotal().toFixed(2)}
              </p>
              <p className="text-black/40 text-sm mt-1">
                {expenses.length} subscription{expenses.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Yearly projection</p>
                <p className="text-xl font-semibold">{currencySymbol}{(calculateMonthlyTotal() * 12).toFixed(2)}</p>
              </div>
              {expenses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAll}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List all subscriptions */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscriptions yet.</p>
            <p className="text-sm text-muted-foreground">Add your first subscription to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => {
            const categoryKey = getCategoryFromNotes(expense.notes);
            const Icon = categoryIcons[categoryKey] || CreditCard;
            const frequencyLabels: Record<string, string> = {
              weekly: 'Weekly',
              biweekly: 'Biweekly',
              monthly: 'Monthly',
              quarterly: 'Quarterly',
              annually: 'Annually',
            };

            return (
              <Card key={expense.id} className="border-slate-200 dark:border-slate-800">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium">{expense.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {frequencyLabels[expense.frequency || 'monthly']}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{currencySymbol}{expense.amount.toFixed(2)}</p>
                      {expense.frequency !== 'monthly' && (
                        <p className="text-xs text-muted-foreground">
                          {currencySymbol}{(expense.amount * (
                            expense.frequency === 'annually' ? 0.083 :
                            expense.frequency === 'quarterly' ? 0.33 :
                            expense.frequency === 'weekly' ? 4.33 : 1
                          )).toFixed(2)}/mo
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
