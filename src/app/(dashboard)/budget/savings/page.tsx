'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, PiggyBank, Building2, TrendingUp, Landmark, Bitcoin, Banknote } from 'lucide-react';
import type { Tables } from '@/types/database';

type SavingsAccount = Tables<'savings_accounts'>;

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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SavingsAccount | null>(null);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('savings');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');

  useEffect(() => {
    fetchAccounts();
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

  function getAccountIcon(accountType: string) {
    const found = accountTypes.find((t) => t.value === accountType);
    const Icon = found?.icon || PiggyBank;
    return <Icon className="h-5 w-5 text-black" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings</h1>
          <p className="text-muted-foreground">Track your savings and investments</p>
        </div>
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

      {/* Total Savings Card */}
      <Card className="border-black/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Total Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            ${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
            <p className="text-sm text-muted-foreground">Add your first account to track your savings.</p>
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
                      ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-2">
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
