'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, Target, Sparkles, PiggyBank, ArrowUpCircle } from 'lucide-react';
import type { Tables } from '@/types/database';

type SavingsGoal = Tables<'savings_goals'>;

const goalTypes = [
  { value: 'emergency_fund', label: 'Emergency Fund', icon: '🛡️' },
  { value: 'vacation', label: 'Vacation', icon: '✈️' },
  { value: 'big_purchase', label: 'Big Purchase', icon: '🛒' },
  { value: 'retirement', label: 'Retirement', icon: '🏖️' },
  { value: 'debt_payoff', label: 'Debt Payoff', icon: '💳' },
  { value: 'other', label: 'Other', icon: '🎯' },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<SavingsGoal | null>(null);
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('other');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');

  useEffect(() => {
    fetchGoals();
  }, []);

  async function fetchGoals() {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (!error && data) {
      setGoals(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const goalData = {
      name,
      type,
      target_amount: parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount) || 0,
      monthly_contribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
      target_date: targetDate || null,
    };

    if (editingGoal) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_goals') as any)
        .update(goalData)
        .eq('id', editingGoal.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_goals') as any).insert({
        user_id: user.id,
        ...goalData,
      });
    }

    resetForm();
    setDialogOpen(false);
    fetchGoals();
  }

  async function handleContribution(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoalForContribution) return;

    const newAmount = selectedGoalForContribution.current_amount + parseFloat(contributionAmount);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('savings_goals') as any)
      .update({ current_amount: newAmount })
      .eq('id', selectedGoalForContribution.id);

    setContributionAmount('');
    setContributionDialogOpen(false);
    setSelectedGoalForContribution(null);
    fetchGoals();
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('savings_goals') as any)
      .update({ is_active: false })
      .eq('id', id);
    fetchGoals();
  }

  function openEditDialog(goal: SavingsGoal) {
    setEditingGoal(goal);
    setName(goal.name);
    setType(goal.type);
    setTargetAmount(goal.target_amount.toString());
    setCurrentAmount(goal.current_amount.toString());
    setMonthlyContribution(goal.monthly_contribution?.toString() || '');
    setTargetDate(goal.target_date || '');
    setDialogOpen(true);
  }

  function openContributionDialog(goal: SavingsGoal) {
    setSelectedGoalForContribution(goal);
    setContributionDialogOpen(true);
  }

  function resetForm() {
    setEditingGoal(null);
    setName('');
    setType('other');
    setTargetAmount('');
    setCurrentAmount('0');
    setMonthlyContribution('');
    setTargetDate('');
  }

  function getTotalSavings(): number {
    return goals.reduce((total, goal) => total + goal.current_amount, 0);
  }

  function getTotalTarget(): number {
    return goals.reduce((total, goal) => total + goal.target_amount, 0);
  }

  function getMonthsToGoal(goal: SavingsGoal): number | null {
    if (!goal.monthly_contribution || goal.monthly_contribution <= 0) return null;
    const remaining = goal.target_amount - goal.current_amount;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / goal.monthly_contribution);
  }

  function getProgress(goal: SavingsGoal): number {
    if (goal.target_amount === 0) return 100;
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100);
  }

  function getGoalIcon(type: string): string {
    return goalTypes.find((t) => t.value === type)?.icon || '🎯';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">Track progress towards your financial goals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGoal ? 'Edit' : 'Add'} Savings Goal</DialogTitle>
              <DialogDescription>
                {editingGoal ? 'Update your savings goal details.' : 'Create a new savings goal to track.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Emergency Fund, New Car"
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
                    {goalTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target Amount ($)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentAmount">Current Amount ($)</Label>
                  <Input
                    id="currentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyContribution">Monthly Contribution ($)</Label>
                  <Input
                    id="monthlyContribution"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="500"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetDate">Target Date (Optional)</Label>
                  <Input
                    id="targetDate"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingGoal ? 'Update' : 'Create'} Goal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contribution Dialog */}
      <Dialog open={contributionDialogOpen} onOpenChange={setContributionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>
              Add funds to &quot;{selectedGoalForContribution?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContribution} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contribution">Amount ($)</Label>
              <Input
                id="contribution"
                type="number"
                step="0.01"
                min="0"
                placeholder="100"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Add Contribution
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Total Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold tracking-tight">
              ${getTotalSavings().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-black/40 text-sm mt-1">
              across {goals.length} goal{goals.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Total Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${getTotalTarget().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <Progress value={(getTotalSavings() / getTotalTarget()) * 100 || 0} className="mt-2" />
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-black/40">
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {getTotalTarget() > 0
                ? ((getTotalSavings() / getTotalTarget()) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-black/40 text-sm">
              ${(getTotalTarget() - getTotalSavings()).toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No savings goals yet.</p>
            <p className="text-sm text-muted-foreground">Create your first goal to start saving.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = getProgress(goal);
            const monthsLeft = getMonthsToGoal(goal);

            return (
              <Card key={goal.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getGoalIcon(goal.type)}</span>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {goalTypes.find((t) => t.value === goal.type)?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openContributionDialog(goal)}>
                        <ArrowUpCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(goal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">
                        ${goal.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground">
                        ${goal.target_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <p className="text-right text-xs text-muted-foreground mt-1">
                      {progress.toFixed(1)}% complete
                    </p>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <div>
                      {goal.monthly_contribution && (
                        <p className="text-muted-foreground">
                          Contributing <span className="font-medium text-foreground">
                            ${goal.monthly_contribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>/mo
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {monthsLeft !== null && (
                        <p className="text-muted-foreground">
                          {monthsLeft === 0 ? (
                            <span className="font-medium">Goal reached!</span>
                          ) : (
                            <>~{monthsLeft} month{monthsLeft !== 1 ? 's' : ''} left</>
                          )}
                        </p>
                      )}
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
