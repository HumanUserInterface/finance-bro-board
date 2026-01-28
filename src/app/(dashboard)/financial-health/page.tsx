'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  DollarSign,
  Loader2,
} from 'lucide-react';

interface FinancialData {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBills: number;
  discretionaryBudget: number;
  totalSavings: number;
  savingsGoals: Array<{ name: string; target: number; current: number; progress: number }>;
}

interface HealthAnalysis {
  score: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  savingsRate: number;
  emergencyFundMonths: number;
  recommendations: string[];
}

interface AffordabilityResult {
  canAfford: boolean;
  percentageOfIncome: number;
  percentageOfDisposable: number;
  percentageOfSavings: number;
  verdict: string;
  verdictColor: string;
}

function calculateHealth(data: FinancialData): HealthAnalysis {
  const totalOutflow = data.monthlyExpenses + data.monthlyBills;
  const disposable = data.monthlyIncome - totalOutflow;
  const savingsRate = data.monthlyIncome > 0 ? (disposable / data.monthlyIncome) * 100 : 0;
  const emergencyFundMonths = totalOutflow > 0 ? data.totalSavings / totalOutflow : 0;

  let score = 50;

  // Savings rate impact
  if (savingsRate >= 20) score += 25;
  else if (savingsRate >= 10) score += 15;
  else if (savingsRate >= 5) score += 5;
  else if (savingsRate < 0) score -= 25;
  else score -= 10;

  // Emergency fund impact
  if (emergencyFundMonths >= 6) score += 15;
  else if (emergencyFundMonths >= 3) score += 8;
  else if (emergencyFundMonths < 1) score -= 15;

  // Goals progress impact
  const avgGoalProgress = data.savingsGoals.length > 0
    ? data.savingsGoals.reduce((sum, g) => sum + g.progress, 0) / data.savingsGoals.length
    : 50;
  if (avgGoalProgress >= 75) score += 10;
  else if (avgGoalProgress < 25) score -= 5;

  score = Math.max(0, Math.min(100, score));

  let riskLevel: HealthAnalysis['riskLevel'];
  if (score >= 70) riskLevel = 'low';
  else if (score >= 50) riskLevel = 'moderate';
  else if (score >= 30) riskLevel = 'high';
  else riskLevel = 'critical';

  const recommendations: string[] = [];
  if (savingsRate < 20) recommendations.push('Increase your savings rate to at least 20% of income');
  if (emergencyFundMonths < 3) recommendations.push('Build an emergency fund covering 3-6 months of expenses');
  if (disposable < 0) recommendations.push('Your expenses exceed income - review your budget urgently');
  if (data.savingsGoals.some(g => g.progress < 25)) recommendations.push('Some savings goals are behind schedule');
  if (recommendations.length === 0) recommendations.push('Great job! Keep maintaining your healthy financial habits');

  return { score, riskLevel, savingsRate, emergencyFundMonths, recommendations };
}

function checkAffordability(price: number, data: FinancialData): AffordabilityResult {
  const disposable = data.monthlyIncome - data.monthlyExpenses - data.monthlyBills;
  const percentageOfIncome = data.monthlyIncome > 0 ? (price / data.monthlyIncome) * 100 : 999;
  const percentageOfDisposable = disposable > 0 ? (price / disposable) * 100 : 999;
  const percentageOfSavings = data.totalSavings > 0 ? (price / data.totalSavings) * 100 : 999;

  let verdict: string;
  let verdictColor: string;
  let canAfford: boolean;

  if (percentageOfIncome <= 5 && percentageOfSavings <= 2) {
    verdict = 'Easily Affordable';
    verdictColor = 'bg-green-100 text-green-800';
    canAfford = true;
  } else if (percentageOfIncome <= 15 && percentageOfSavings <= 10) {
    verdict = 'Affordable';
    verdictColor = 'bg-green-50 text-green-700';
    canAfford = true;
  } else if (percentageOfIncome <= 30 && percentageOfDisposable <= 100) {
    verdict = 'Stretch';
    verdictColor = 'bg-yellow-100 text-yellow-800';
    canAfford = true;
  } else if (percentageOfSavings <= 30) {
    verdict = 'Not Recommended';
    verdictColor = 'bg-orange-100 text-orange-800';
    canAfford = false;
  } else {
    verdict = 'Unaffordable';
    verdictColor = 'bg-red-100 text-red-800';
    canAfford = false;
  }

  return { canAfford, percentageOfIncome, percentageOfDisposable, percentageOfSavings, verdict, verdictColor };
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 30) return 'text-orange-600';
  return 'text-red-600';
}

function getRiskBadgeColor(risk: string): string {
  switch (risk) {
    case 'low': return 'bg-green-100 text-green-800';
    case 'moderate': return 'bg-yellow-100 text-yellow-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'critical': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function FinancialHealthPage() {
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [health, setHealth] = useState<HealthAnalysis | null>(null);
  const [testPrice, setTestPrice] = useState('');
  const [affordability, setAffordability] = useState<AffordabilityResult | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchFinancialData();
  }, []);

  async function fetchFinancialData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [incomeRes, expensesRes, billsRes, goalsRes, accountsRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('bills').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('savings_goals').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('savings_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
    ]);

    const incomes = incomeRes.data || [];
    const expenses = expensesRes.data || [];
    const bills = billsRes.data || [];
    const goals = goalsRes.data || [];
    const accounts = accountsRes.data || [];

    const frequencyMultipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
      one_time: 0,
    };

    const monthlyIncome = incomes.reduce((total, inc) => {
      return total + inc.amount * (frequencyMultipliers[inc.frequency] || 0);
    }, 0);

    // Only count fixed recurring expenses (subscriptions), not variable budget allocations (wants)
    const monthlyExpenses = expenses
      .filter((e) => e.is_recurring && e.type === 'fixed')
      .reduce((total, exp) => {
        return total + exp.amount * (frequencyMultipliers[exp.frequency || 'monthly'] || 0);
      }, 0);

    const monthlyBills = bills.reduce((total, bill) => {
      return total + bill.amount * (frequencyMultipliers[bill.frequency] || 0);
    }, 0);

    const savingsFromGoals = goals.reduce((total, goal) => total + goal.current_amount, 0);
    const savingsFromAccounts = accounts
      .filter(a => a.type === 'savings' || a.type === 'checking')
      .reduce((total, acc) => total + acc.balance, 0);

    const data: FinancialData = {
      monthlyIncome,
      monthlyExpenses,
      monthlyBills,
      discretionaryBudget: monthlyIncome - monthlyExpenses - monthlyBills,
      totalSavings: savingsFromGoals + savingsFromAccounts,
      savingsGoals: goals.map((g) => ({
        name: g.name,
        target: g.target_amount,
        current: g.current_amount,
        progress: g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0,
      })),
    };

    setFinancialData(data);
    setHealth(calculateHealth(data));
    setLoading(false);
  }

  function handleTestAffordability() {
    const price = parseFloat(testPrice);
    if (isNaN(price) || price <= 0 || !financialData) return;
    setAffordability(checkAffordability(price, financialData));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!financialData || !health) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financial Health</h1>
          <p className="text-muted-foreground">Set up your income and expenses first</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <HeartPulse className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No financial data found.</p>
            <p className="text-sm text-muted-foreground">Add your income and expenses to see your financial health.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Financial Health</h1>
        <p className="text-muted-foreground">
          Your overall financial wellness score and analysis
        </p>
      </div>

      {/* Health Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5" />
            Health Score
          </CardTitle>
          <CardDescription>Based on your income, expenses, and savings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            {/* Score Circle */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(health.score / 100) * 352} 352`}
                    className={getScoreColor(health.score)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(health.score)}`}>
                    {health.score}
                  </span>
                </div>
              </div>
              <Badge className={`mt-3 ${getRiskBadgeColor(health.riskLevel)}`}>
                {health.riskLevel.charAt(0).toUpperCase() + health.riskLevel.slice(1)} Risk
              </Badge>
            </div>

            {/* Metrics */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Savings Rate
                </div>
                <div className={`text-2xl font-bold ${health.savingsRate >= 20 ? 'text-green-600' : health.savingsRate >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {health.savingsRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Target: 20%+</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PiggyBank className="h-4 w-4" />
                  Emergency Fund
                </div>
                <div className={`text-2xl font-bold ${health.emergencyFundMonths >= 6 ? 'text-green-600' : health.emergencyFundMonths >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {health.emergencyFundMonths.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">months covered</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Wallet className="h-4 w-4" />
                  Disposable
                </div>
                <div className={`text-2xl font-bold ${financialData.discretionaryBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${financialData.discretionaryBudget.toFixed(0)}
                </div>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  Total Savings
                </div>
                <div className="text-2xl font-bold text-green-600">
                  ${financialData.totalSavings.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">across all accounts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {health.score >= 70 ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {health.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-1 h-2 w-2 rounded-full ${health.score >= 70 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Affordability Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Affordability Calculator
          </CardTitle>
          <CardDescription>
            Test if a purchase fits your budget before submitting to the board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="test-price">Purchase Price ($)</Label>
              <div className="flex gap-2">
                <Input
                  id="test-price"
                  type="number"
                  placeholder="e.g., 500"
                  value={testPrice}
                  onChange={(e) => setTestPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestAffordability()}
                />
                <Button onClick={handleTestAffordability}>
                  Check
                </Button>
              </div>
            </div>

            {affordability && (
              <div className="flex-1 p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">Result</span>
                  <Badge className={affordability.verdictColor}>
                    {affordability.verdict}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% of Monthly Income</span>
                    <span className="font-medium">{affordability.percentageOfIncome.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% of Disposable Income</span>
                    <span className="font-medium">{affordability.percentageOfDisposable.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">% of Total Savings</span>
                    <span className="font-medium">{affordability.percentageOfSavings.toFixed(1)}%</span>
                  </div>
                </div>
                {!affordability.canAfford && (
                  <p className="mt-3 text-sm text-orange-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    This purchase may strain your finances
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Income</span>
                <span className="font-medium text-green-600">
                  ${financialData.monthlyIncome.toFixed(2)}
                </span>
              </div>
              <Progress value={100} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Recurring Expenses</span>
                <span className="font-medium text-red-600">
                  -${financialData.monthlyExpenses.toFixed(2)}
                </span>
              </div>
              <Progress
                value={(financialData.monthlyExpenses / financialData.monthlyIncome) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Bills</span>
                <span className="font-medium text-orange-600">
                  -${financialData.monthlyBills.toFixed(2)}
                </span>
              </div>
              <Progress
                value={(financialData.monthlyBills / financialData.monthlyIncome) * 100}
                className="h-2"
              />
            </div>

            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Remaining (Disposable)</span>
                <span className={`font-bold ${financialData.discretionaryBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${financialData.discretionaryBudget.toFixed(2)}
                </span>
              </div>
              <Progress
                value={Math.max(0, (financialData.discretionaryBudget / financialData.monthlyIncome) * 100)}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Savings Goals Progress */}
      {financialData.savingsGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Savings Goals Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {financialData.savingsGoals.map((goal, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{goal.name}</span>
                    <span className="text-muted-foreground">
                      ${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.min(100, goal.progress)} className="flex-1 h-2" />
                    <span className="text-sm font-medium w-12 text-right">
                      {goal.progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
