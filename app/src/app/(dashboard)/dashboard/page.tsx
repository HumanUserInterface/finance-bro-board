import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { HelpCircle, TrendingUp, Target, Calendar } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your financial overview</p>
      </div>

      {/* Quick Action */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Thinking about a purchase?</h2>
              <p className="text-primary-foreground/80">Let the board help you decide</p>
            </div>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/decide">
                <HelpCircle className="mr-2 h-5 w-5" />
                Can I afford this?
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Financial Health Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Financial Health
            </CardTitle>
            <CardDescription>Your overall score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-2">72</div>
            <p className="text-sm text-muted-foreground">Good - Keep it up!</p>
            <Progress value={72} className="mt-4" />
          </CardContent>
        </Card>

        {/* Monthly Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
            <CardDescription>This month&apos;s summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium text-green-600">+$0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium text-red-600">-$0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bills</span>
              <span className="font-medium text-red-600">-$0</span>
            </div>
            <div className="border-t pt-2 flex justify-between">
              <span className="font-medium">Discretionary</span>
              <span className="font-bold">$0</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Top Goals
            </CardTitle>
            <CardDescription>Your savings progress</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No goals yet</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/goals">Add a goal</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Bills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Bills
            </CardTitle>
            <CardDescription>Next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No upcoming bills</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/expenses">Add bills</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Deliberations */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Deliberations</CardTitle>
            <CardDescription>Your last purchase decisions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No deliberations yet</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/history">View history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
