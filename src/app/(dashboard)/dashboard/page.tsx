import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react';

export default function DashboardPage() {
  // TODO: Fetch real data from Supabase
  const stats = {
    monthlyIncome: 5000,
    monthlyExpenses: 2800,
    monthlyBills: 500,
    discretionaryBudget: 1700,
    discretionarySpent: 544,
    savingsGoalProgress: 75,
  };

  const discretionaryPercent = Math.round(
    (stats.discretionarySpent / stats.discretionaryBudget) * 100
  );

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.monthlyIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${stats.monthlyExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bills Due</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${stats.monthlyBills.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${(stats.discretionaryBudget - stats.discretionarySpent).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discretionary Budget */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Discretionary Budget</CardTitle>
            <CardDescription>
              ${stats.discretionarySpent} of ${stats.discretionaryBudget} spent this month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={discretionaryPercent} className="h-3" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {discretionaryPercent}% used
              </span>
              <span className="font-medium text-green-600">
                ${stats.discretionaryBudget - stats.discretionarySpent} remaining
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Savings Goals</CardTitle>
            <CardDescription>Progress towards your goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Emergency Fund</span>
                <span>75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vacation Fund</span>
                <span>45%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>New Laptop</span>
                <span>60%</span>
              </div>
              <Progress value={60} className="h-2" />
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
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium">MacBook Pro M4</p>
                  <p className="text-sm text-muted-foreground">$2,499 - Tech</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-600">APPROVED</p>
                <p className="text-sm text-muted-foreground">12-5 vote</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-medium">Designer Sunglasses</p>
                  <p className="text-sm text-muted-foreground">$450 - Fashion</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-red-600">REJECTED</p>
                <p className="text-sm text-muted-foreground">5-12 vote</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium">Gym Membership</p>
                  <p className="text-sm text-muted-foreground">$50/mo - Health</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-600">APPROVED</p>
                <p className="text-sm text-muted-foreground">15-2 vote</p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Link href="/history">
              <Button variant="outline">View All History</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
