"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Target } from "lucide-react"

export default function GoalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">Track your progress toward financial goals</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Goal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Goals</CardTitle>
          <CardDescription>Set targets and watch your savings grow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No savings goals yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create goals for emergency fund, vacation, big purchases, and more
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create your first goal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
