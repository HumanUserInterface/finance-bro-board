'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PlusCircle, TrendingUp, TrendingDown, Wallet, Target, PiggyBank, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Tables } from '@/types/database';

type PurchaseRequest = Tables<'purchase_requests'>;
type Deliberation = Tables<'deliberations'>;
type SavingsGoal = Tables<'savings_goals'>;

interface FinancialStats {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBills: number;
  discretionaryBudget: number;
  totalSavings: number;
  savingsGoals: SavingsGoal[];
}

interface RecentDeliberation {
  id: string;
  item: string;
  price: number;
  category: string;
  decision: 'approve' | 'reject';
  approveCount: number;
  rejectCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [recentDeliberations, setRecentDeliberations] = useState<RecentDeliberation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const frequencyMultipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
      one_time: 0,
    };

    // Fetch all financial data in parallel
    const [incomeRes, expensesRes, billsRes, goalsRes, purchasesRes, deliberationsRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('is_active', true),
      supabase.from('expenses').select('*').eq('is_active', true),
      supabase.from('bills').select('*').eq('is_active', true),
      supabase.from('savings_goals').select('*').eq('is_active', true).order('priority'),
      supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('deliberations').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    const incomes = (incomeRes.data || []) as Tables<'income_sources'>[];
    const expenses = (expensesRes.data || []) as Tables<'expenses'>[];
    const bills = (billsRes.data || []) as Tables<'bills'>[];
    const goals = (goalsRes.data || []) as SavingsGoal[];
    const purchases = (purchasesRes.data || []) as PurchaseRequest[];
    const deliberations = (deliberationsRes.data || []) as Deliberation[];

    // Calculate monthly totals
    const monthlyIncome = incomes.reduce((total, inc) => {
      return total + inc.amount * (frequencyMultipliers[inc.frequency] || 0);
    }, 0);

    const monthlyExpenses = expenses
      .filter((e) => e.is_recurring)
      .reduce((total, exp) => {
        return total + exp.amount * (frequencyMultipliers[exp.frequency || 'monthly'] || 0);
      }, 0);

    const monthlyBills = bills.reduce((total, bill) => {
      return total + bill.amount * (frequencyMultipliers[bill.frequency] || 0);
    }, 0);

    const discretionaryBudget = monthlyIncome - monthlyExpenses - monthlyBills;
    const totalSavings = goals.reduce((total, goal) => total + goal.current_amount, 0);

    setStats({
      monthlyIncome,
      monthlyExpenses,
      monthlyBills,
      discretionaryBudget,
      totalSavings,
      savingsGoals: goals,
    });

    // Map deliberations to purchases
    const recent: RecentDeliberation[] = [];
    for (const delib of deliberations) {
      const purchase = purchases.find((p) => p.id === delib.purchase_id);
      if (purchase) {
        recent.push({
          id: delib.id,
          item: purchase.item,
          price: purchase.price,
          category: purchase.category,
          decision: delib.final_decision,
          approveCount: delib.approve_count,
          rejectCount: delib.reject_count,
        });
      }
    }
    setRecentDeliberations(recent);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your financial overview</p>
        </div>
        <Link href="/deliberate">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Purchase
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-widest text-black/40">Monthly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${stats?.monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <p className="text-xs text-black/40 mt-1">
              <Link href="/budget/income" className="hover:underline">Manage</Link>
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-widest text-black/40">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${stats?.monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <p className="text-xs text-black/40 mt-1">
              <Link href="/budget/expenses" className="hover:underline">Manage</Link>
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-widest text-black/40">Monthly Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${stats?.monthlyBills.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <p className="text-xs text-black/40 mt-1">
              <Link href="/budget/bills" className="hover:underline">Manage</Link>
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-widest text-black/40">Discretionary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              ${stats?.discretionaryBudget.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <p className="text-xs text-black/40 mt-1">Available for purchases</p>
          </CardContent>
        </Card>
      </div>

      {/* Savings & Budget Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Total Savings
                </CardTitle>
                <CardDescription>Across all your goals</CardDescription>
              </div>
              <div className="text-2xl font-bold">
                ${stats?.totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.savingsGoals && stats.savingsGoals.length > 0 ? (
              stats.savingsGoals.slice(0, 3).map((goal) => {
                const progress = goal.target_amount > 0
                  ? (goal.current_amount / goal.target_amount) * 100
                  : 0;
                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{goal.name}</span>
                      <span className="text-muted-foreground">
                        ${goal.current_amount.toLocaleString()} / ${goal.target_amount.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No savings goals yet.{' '}
                <Link href="/budget/goals" className="text-primary hover:underline">Add one</Link>
              </p>
            )}
            {stats?.savingsGoals && stats.savingsGoals.length > 3 && (
              <div className="text-center">
                <Link href="/budget/goals">
                  <Button variant="ghost" size="sm">View all goals</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget Health</CardTitle>
            <CardDescription>Monthly income vs expenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-black" />
                  Income
                </span>
                <span>${stats?.monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-black/60" />
                  Expenses
                </span>
                <span>${stats?.monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-black/30" />
                  Bills
                </span>
                <span>${stats?.monthlyBills.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}</span>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between font-medium">
                <span>Savings Rate</span>
                <span>
                  {stats?.monthlyIncome && stats.monthlyIncome > 0
                    ? ((stats.discretionaryBudget / stats.monthlyIncome) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deliberations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliberations</CardTitle>
          <CardDescription>Your latest board decisions</CardDescription>
        </CardHeader>
        <CardContent>
          {recentDeliberations.length > 0 ? (
            <div className="space-y-4">
              {recentDeliberations.map((delib) => (
                <div key={delib.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{delib.decision === 'approve' ? '✅' : '❌'}</span>
                    <div>
                      <p className="font-medium">{delib.item}</p>
                      <p className="text-sm text-muted-foreground">
                        ${delib.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} - {delib.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-black/5 text-black">
                      {delib.decision === 'approve' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> APPROVED</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> REJECTED</>
                      )}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">{delib.approveCount}-{delib.rejectCount} vote</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No deliberations yet.</p>
              <p className="text-sm text-muted-foreground mb-4">Submit your first purchase for the board to review!</p>
              <Link href="/deliberate">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Purchase
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
