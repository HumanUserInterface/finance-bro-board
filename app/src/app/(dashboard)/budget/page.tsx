"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PiggyBank } from "lucide-react"

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monthly Budget</h1>
        <p className="text-muted-foreground">Allocate your income for the month</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Needs (50%)</CardTitle>
            <CardDescription>Bills, rent, groceries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">$0 / $0</div>
            <Progress value={0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Wants (30%)</CardTitle>
            <CardDescription>Entertainment, dining</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">$0 / $0</div>
            <Progress value={0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Savings (20%)</CardTitle>
            <CardDescription>Goals, investments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">$0 / $0</div>
            <Progress value={0} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Budget Breakdown
          </CardTitle>
          <CardDescription>Your monthly allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">Set up your budget</h3>
            <p className="text-muted-foreground text-sm">
              Add income first to start allocating your budget
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
