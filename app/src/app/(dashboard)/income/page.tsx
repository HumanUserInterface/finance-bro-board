"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Wallet } from "lucide-react"

export default function IncomePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income</h1>
          <p className="text-muted-foreground">Manage your income sources</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Total Monthly Income
            </CardTitle>
            <CardDescription>All active income sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$0</div>
            <p className="text-sm text-muted-foreground mt-2">
              Add your income sources to start tracking
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Sources</CardTitle>
          <CardDescription>Your recurring and one-time income</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No income sources yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your salary, side income, or other revenue streams
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add your first income
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
