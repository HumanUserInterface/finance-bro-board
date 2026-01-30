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
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, CalendarClock, CreditCard, AlertCircle } from 'lucide-react';
import type { Tables } from '@/types/database';

type Bill = Tables<'bills'>;

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('1');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [isAutopay, setIsAutopay] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState('3');

  useEffect(() => {
    fetchBills();
  }, []);

  async function fetchBills() {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('is_active', true)
      .order('due_day', { ascending: true });

    if (!error && data) {
      setBills(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingBill) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('bills') as any)
        .update({
          name,
          amount: parseFloat(amount),
          due_day: parseInt(dueDay),
          frequency,
          is_autopay: isAutopay,
          reminder_days: reminderEnabled ? parseInt(reminderDays) : 0,
        })
        .eq('id', editingBill.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('bills') as any).insert({
        user_id: user.id,
        name,
        amount: parseFloat(amount),
        due_day: parseInt(dueDay),
        frequency,
        is_autopay: isAutopay,
        reminder_days: reminderEnabled ? parseInt(reminderDays) : 0,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchBills();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('bills') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchBills();
  }

  function openEditDialog(bill: Bill) {
    setEditingBill(bill);
    setName(bill.name);
    setAmount(bill.amount.toString());
    setDueDay(bill.due_day.toString());
    setFrequency(bill.frequency);
    setIsAutopay(bill.is_autopay);
    setReminderEnabled(bill.reminder_days > 0);
    setReminderDays(bill.reminder_days > 0 ? bill.reminder_days.toString() : '3');
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingBill(null);
    setName('');
    setAmount('');
    setDueDay('1');
    setFrequency('monthly');
    setIsAutopay(false);
    setReminderEnabled(true);
    setReminderDays('3');
  }

  function calculateMonthlyTotal(): number {
    return bills.reduce((total, bill) => {
      const multipliers: Record<string, number> = {
        weekly: 4.33,
        biweekly: 2.17,
        monthly: 1,
        quarterly: 0.33,
        annually: 0.083,
      };
      return total + bill.amount * (multipliers[bill.frequency] || 0);
    }, 0);
  }

  function getDaysUntilDue(dueDay: number): number {
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    if (dueDay >= currentDay) {
      return dueDay - currentDay;
    }
    return daysInMonth - currentDay + dueDay;
  }

  function getDueStatus(dueDay: number): { color: string; label: string } {
    const daysUntil = getDaysUntilDue(dueDay);

    if (daysUntil === 0) {
      return { color: 'bg-black/20 text-black', label: 'Due Today' };
    } else if (daysUntil <= 3) {
      return { color: 'bg-black/15 text-black', label: `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` };
    } else if (daysUntil <= 7) {
      return { color: 'bg-black/10 text-black', label: `Due in ${daysUntil} days` };
    }
    return { color: 'bg-black/5 text-black', label: `Due in ${daysUntil} days` };
  }

  function getUpcomingBills(): Bill[] {
    return [...bills]
      .sort((a, b) => getDaysUntilDue(a.due_day) - getDaysUntilDue(b.due_day))
      .slice(0, 5);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bills</h1>
          <p className="text-muted-foreground">Track and manage your recurring bills</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBill ? 'Edit' : 'Add'} Bill</DialogTitle>
              <DialogDescription>
                {editingBill ? 'Update your bill details.' : 'Add a new recurring bill.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Bill Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Electricity, Internet, Phone"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="dueDay">Due Day of Month</Label>
                  <Input
                    id="dueDay"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1-31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    required
                  />
                </div>
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
              <div className="flex items-center space-x-2">
                <Switch
                  id="autopay"
                  checked={isAutopay}
                  onCheckedChange={setIsAutopay}
                />
                <Label htmlFor="autopay">Autopay enabled</Label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="reminderEnabled"
                    checked={reminderEnabled}
                    onCheckedChange={setReminderEnabled}
                  />
                  <Label htmlFor="reminderEnabled">Enable reminder</Label>
                </div>
                {reminderEnabled && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="reminderDays">Days before due date</Label>
                    <Input
                      id="reminderDays"
                      type="number"
                      min="1"
                      max="30"
                      placeholder="3"
                      value={reminderDays}
                      onChange={(e) => setReminderDays(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">
                {editingBill ? 'Update' : 'Add'} Bill
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">Monthly Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tracking-tight">
              ${calculateMonthlyTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-black/40 text-sm mt-1">
              {bills.length} bill{bills.length !== 1 ? 's' : ''} tracked
            </p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Upcoming Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getUpcomingBills().length > 0 ? (
              <div className="space-y-2">
                {getUpcomingBills().slice(0, 3).map((bill) => {
                  const status = getDueStatus(bill.due_day);
                  return (
                    <div key={bill.id} className="flex justify-between items-center text-sm">
                      <span>{bill.name}</span>
                      <span className="text-black/40 text-xs">{status.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-black/40 text-sm">No upcoming bills</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : bills.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No bills yet.</p>
            <p className="text-sm text-muted-foreground">Add your first bill to start tracking due dates.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bills.map((bill) => {
            const status = getDueStatus(bill.due_day);
            return (
              <Card key={bill.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-black/5 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-black" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{bill.name}</p>
                        {bill.is_autopay && (
                          <span className="text-xs text-black/40">Autopay</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Due day {bill.due_day} &bull;{' '}
                        {frequencies.find((f) => f.value === bill.frequency)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        ${bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <span className="text-xs text-black/40">
                        {status.label}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(bill)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(bill.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
