"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Receipt, CreditCard } from "lucide-react"

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage your bills and subscriptions</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Monthly Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$0</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="bills">
          <Card>
            <CardHeader>
              <CardTitle>Bills</CardTitle>
              <CardDescription>Your recurring bills and fixed expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No bills yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Add rent, utilities, insurance, and other bills
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add a bill
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>Your recurring subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No subscriptions yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Add Netflix, Spotify, gym memberships, and more
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add a subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
