'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, PiggyBank, Building2, TrendingUp, Landmark, Bitcoin, Banknote, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import type { Tables } from '@/types/database';

type SavingsAccount = Tables<'savings_accounts'>;
type SavingsGoal = Tables<'savings_goals'>;

const accountTypes = [
  { value: 'checking', label: 'Checking Account', icon: Building2 },
  { value: 'savings', label: 'Savings Account', icon: PiggyBank },
  { value: 'investment', label: 'Investment Account', icon: TrendingUp },
  { value: 'retirement', label: 'Retirement (401k, IRA)', icon: Landmark },
  { value: 'crypto', label: 'Cryptocurrency', icon: Bitcoin },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'other', label: 'Other', icon: PiggyBank },
];

export default function SavingsPage() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | null>(null);
  const [selectedAccountForWithdraw, setSelectedAccountForWithdraw] = useState<SavingsAccount | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('savings');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');

  // Confirm savings state
  const [monthsToConfirm, setMonthsToConfirm] = useState(1);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    fetchAccounts();
    fetchSavingsGoals();
  }, []);

  async function fetchAccounts() {
    const { data, error } = await supabase
      .from('savings_accounts')
      .select('*')
      .eq('is_active', true)
      .order('balance', { ascending: false });

    if (!error && data) {
      setAccounts(data);
    }
    setLoading(false);
  }

  async function fetchSavingsGoals() {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (!error && data) {
      setSavingsGoals(data);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingAccount) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_accounts') as any)
        .update({
          name,
          type,
          balance: parseFloat(balance),
          institution: institution || null,
        })
        .eq('id', editingAccount.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_accounts') as any).insert({
        user_id: user.id,
        name,
        type,
        balance: parseFloat(balance),
        institution: institution || null,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchAccounts();
  }

  async function handleConfirmMonthlySavings() {
    setIsConfirming(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For each savings goal with a monthly contribution
      for (const goal of savingsGoals) {
        if (!goal.monthly_contribution || goal.monthly_contribution <= 0) continue;

        const amountToAdd = goal.monthly_contribution * monthsToConfirm;

        // Check if an account with the same name already exists
        const existingAccount = accounts.find(
          (acc) => acc.name.toLowerCase() === goal.name.toLowerCase()
        );

        if (existingAccount) {
          // Update existing account balance
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('savings_accounts') as any)
            .update({
              balance: existingAccount.balance + amountToAdd,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAccount.id);
        } else {
          // Create new account for this goal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('savings_accounts') as any).insert({
            user_id: user.id,
            name: goal.name,
            type: 'savings',
            balance: amountToAdd,
            notes: `Linked to savings goal: ${goal.name}`,
          });
        }
      }

      setConfirmDialogOpen(false);
      setMonthsToConfirm(1);
      fetchAccounts();
    } catch (error) {
      console.error('Error confirming monthly savings:', error);
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountForWithdraw) return;

    const amount = parseFloat(withdrawAmount);
    const newBalance = Math.max(0, selectedAccountForWithdraw.balance - amount);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('savings_accounts') as any)
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', selectedAccountForWithdraw.id);

    setWithdrawAmount('');
    setWithdrawDialogOpen(false);
    setSelectedAccountForWithdraw(null);
    fetchAccounts();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('savings_accounts') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchAccounts();
  }

  function openEditDialog(account: SavingsAccount) {
    setEditingAccount(account);
    setName(account.name);
    setType(account.type);
    setBalance(account.balance.toString());
    setInstitution(account.institution || '');
    setDialogOpen(true);
  }

  function openWithdrawDialog(account: SavingsAccount) {
    setSelectedAccountForWithdraw(account);
    setWithdrawDialogOpen(true);
  }

  function resetForm() {
    setEditingAccount(null);
    setName('');
    setType('savings');
    setBalance('');
    setInstitution('');
  }

  function calculateTotal(): number {
    return accounts.reduce((total, account) => total + account.balance, 0);
  }

  function calculateTotalMonthlyContribution(): number {
    return savingsGoals.reduce((total, goal) => total + (goal.monthly_contribution || 0), 0);
  }

  function getAccountIcon(accountType: string) {
    const found = accountTypes.find((t) => t.value === accountType);
    const Icon = found?.icon || PiggyBank;
    return <Icon className="h-5 w-5 text-black" />;
  }

  const totalMonthlyContribution = calculateTotalMonthlyContribution();
  const hasGoalsWithContributions = savingsGoals.some((g) => g.monthly_contribution && g.monthly_contribution > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings</h1>
          <p className="text-muted-foreground">Track your savings and investments</p>
        </div>
        <div className="flex gap-2">
          {/* Confirm Monthly Savings Button */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!hasGoalsWithContributions}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Monthly Savings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Monthly Savings</DialogTitle>
                <DialogDescription>
                  Add your budgeted savings to your accounts. You can catch up on multiple months if needed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Monthly contributions summary */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Monthly Contributions</p>
                  {savingsGoals.filter((g) => g.monthly_contribution && g.monthly_contribution > 0).map((goal) => (
                    <div key={goal.id} className="flex justify-between text-sm">
                      <span>{goal.name}</span>
                      <span className="font-medium">€{goal.monthly_contribution?.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                    <span>Total per month</span>
                    <span>€{totalMonthlyContribution.toFixed(2)}</span>
                  </div>
                </div>

                {/* Number of months selector */}
                <div className="space-y-2">
                  <Label htmlFor="months">Number of months to confirm</Label>
                  <Select value={monthsToConfirm.toString()} onValueChange={(v) => setMonthsToConfirm(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 12].map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {m} month{m !== 1 ? 's' : ''} {m > 1 ? '(catch-up)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Total to be added */}
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm text-green-600 dark:text-green-400">Total to be added to savings</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    €{(totalMonthlyContribution * monthsToConfirm).toFixed(2)}
                  </p>
                  {monthsToConfirm > 1 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      (€{totalMonthlyContribution.toFixed(2)} × {monthsToConfirm} months)
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleConfirmMonthlySavings}
                  className="w-full"
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Adding to savings...' : 'Confirm & Add to Savings'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Account Button */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? 'Edit' : 'Add'} Savings Account</DialogTitle>
                <DialogDescription>
                  {editingAccount ? 'Update your account details.' : 'Add a new savings or investment account.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Emergency Fund, Roth IRA"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Account Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance">Current Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution">Institution (Optional)</Label>
                  <Input
                    id="institution"
                    placeholder="e.g., Chase, Fidelity, Coinbase"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingAccount ? 'Update' : 'Add'} Account
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Withdraw from &quot;{selectedAccountForWithdraw?.name}&quot;
              {selectedAccountForWithdraw && (
                <span className="block mt-1">
                  Available: €{selectedAccountForWithdraw.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdrawAmount">Amount (€)</Label>
              <Input
                id="withdrawAmount"
                type="number"
                step="0.01"
                min="0"
                max={selectedAccountForWithdraw?.balance || 0}
                placeholder="100"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="destructive" className="w-full">
              Withdraw
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Budget Info Card */}
      {hasGoalsWithContributions && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Monthly Budget Allocation</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  €{totalMonthlyContribution.toFixed(2)}/month
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  From {savingsGoals.filter((g) => g.monthly_contribution && g.monthly_contribution > 0).length} savings goal{savingsGoals.filter((g) => g.monthly_contribution && g.monthly_contribution > 0).length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={() => setConfirmDialogOpen(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Savings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Savings Card */}
      <Card className="border-black/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Total Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            €{calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-black/40 text-sm mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <PiggyBank className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No savings accounts yet.</p>
            <p className="text-sm text-muted-foreground">
              {hasGoalsWithContributions
                ? 'Click "Confirm Monthly Savings" to create accounts from your budget goals.'
                : 'Add your first account to track your savings.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-black/5 flex items-center justify-center">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {accountTypes.find((t) => t.value === account.type)?.label}
                      {account.institution && ` • ${account.institution}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">
                      €{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openWithdrawDialog(account)}
                      disabled={account.balance <= 0}
                      title="Withdraw"
                    >
                      <ArrowDownCircle className="h-4 w-4 text-orange-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(account.id)}>
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
