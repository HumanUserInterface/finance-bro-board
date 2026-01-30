"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HelpCircle, Users, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface FinancialSummary {
  monthlyIncome: number
  monthlyExpenses: number
  monthlyBills: number
  discretionaryBudget: number
  totalSavings: number
}

interface QuickCheckResult {
  canAfford: boolean
  percentageOfBudget: number
  recommendation: 'easily_affordable' | 'affordable' | 'stretch' | 'not_recommended' | 'unaffordable'
  message: string
}

export default function DecidePage() {
  const router = useRouter()
  const supabase = createClient()

  const [item, setItem] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("")
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | ''>(``)
  const [description, setDescription] = useState("")

  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyBills: 0,
    discretionaryBudget: 0,
    totalSavings: 0,
  })

  const [quickCheckResult, setQuickCheckResult] = useState<QuickCheckResult | null>(null)
  const [isLoadingQuickCheck, setIsLoadingQuickCheck] = useState(false)
  const [isLoadingDeliberation, setIsLoadingDeliberation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFinancialData()
  }, [])

  async function loadFinancialData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const frequencyMultipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
      one_time: 0,
    }

    const [incomeRes, expensesRes, billsRes, goalsRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('expenses').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('bills').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('savings_goals').select('*').eq('user_id', user.id).eq('is_active', true),
    ])

    const incomes = incomeRes.data || []
    const expenses = expensesRes.data || []
    const bills = billsRes.data || []
    const goals = goalsRes.data || []

    const monthlyIncome = incomes.reduce((total, inc) => {
      return total + inc.amount * (frequencyMultipliers[inc.frequency] || 0)
    }, 0)

    const monthlyExpenses = expenses
      .filter((e) => e.is_recurring && e.type === 'fixed')
      .reduce((total, exp) => {
        return total + exp.amount * (frequencyMultipliers[exp.frequency || 'monthly'] || 0)
      }, 0)

    const monthlyBills = bills.reduce((total, bill) => {
      return total + bill.amount * (frequencyMultipliers[bill.frequency] || 0)
    }, 0)

    const totalSavings = goals.reduce((total, goal) => total + goal.current_amount, 0)

    setFinancialSummary({
      monthlyIncome,
      monthlyExpenses,
      monthlyBills,
      discretionaryBudget: monthlyIncome - monthlyExpenses - monthlyBills,
      totalSavings,
    })
  }

  function handleQuickCheck() {
    setError(null)
    setQuickCheckResult(null)
    setIsLoadingQuickCheck(true)

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price")
      setIsLoadingQuickCheck(false)
      return
    }

    const { discretionaryBudget, totalSavings, monthlyIncome } = financialSummary
    const percentageOfBudget = discretionaryBudget > 0 ? (priceNum / discretionaryBudget) * 100 : 999
    const percentageOfIncome = monthlyIncome > 0 ? (priceNum / monthlyIncome) * 100 : 999
    const percentageOfSavings = totalSavings > 0 ? (priceNum / totalSavings) * 100 : 999

    let recommendation: QuickCheckResult['recommendation']
    let message: string
    let canAfford: boolean

    if (percentageOfIncome <= 5 && percentageOfSavings <= 2) {
      recommendation = 'easily_affordable'
      message = 'This purchase is well within your means. Go for it!'
      canAfford = true
    } else if (percentageOfIncome <= 15 && percentageOfSavings <= 10) {
      recommendation = 'affordable'
      message = 'This is affordable but will use a notable portion of your budget.'
      canAfford = true
    } else if (percentageOfBudget <= 100 && percentageOfIncome <= 30) {
      recommendation = 'stretch'
      message = 'This is a stretch. Consider if it\'s truly necessary.'
      canAfford = true
    } else if (percentageOfSavings <= 30 || percentageOfIncome <= 50) {
      recommendation = 'not_recommended'
      message = 'This would significantly impact your financial health.'
      canAfford = false
    } else {
      recommendation = 'unaffordable'
      message = 'This is beyond your current financial capacity.'
      canAfford = false
    }

    setTimeout(() => {
      setQuickCheckResult({
        canAfford,
        percentageOfBudget,
        recommendation,
        message,
      })
      setIsLoadingQuickCheck(false)
    }, 500)
  }

  async function handleAskTheBoard() {
    setError(null)
    setQuickCheckResult(null)

    if (!item || !price || !category || !urgency) {
      setError("Please fill in all required fields")
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price")
      return
    }

    setIsLoadingDeliberation(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Please log in to continue")
        setIsLoadingDeliberation(false)
        return
      }

      // Create purchase request
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchase_requests')
        .insert({
          user_id: user.id,
          item,
          price: priceNum,
          category,
          urgency: urgency as 'low' | 'medium' | 'high',
          description: description || null,
          status: 'pending',
        })
        .select()
        .single()

      if (purchaseError || !purchase) {
        throw new Error('Failed to create purchase request')
      }

      // Trigger deliberation
      const response = await fetch('/api/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Deliberation failed')
      }

      // Navigate to the deliberation result page
      router.push(`/decide/${result.deliberationId}`)
    } catch (err) {
      console.error('Deliberation error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoadingDeliberation(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Can I Afford This?</h1>
        <p className="text-muted-foreground">Get a quick check or full AI deliberation</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Purchase Details
            </CardTitle>
            <CardDescription>Tell us what you want to buy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item">What do you want to buy?</Label>
              <Input
                id="item"
                placeholder="e.g., New headphones"
                value={item}
                onChange={(e) => setItem(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">Electronics</SelectItem>
                  <SelectItem value="clothing">Clothing</SelectItem>
                  <SelectItem value="food">Food & Dining</SelectItem>
                  <SelectItem value="entertainment">Entertainment</SelectItem>
                  <SelectItem value="health">Health & Fitness</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="home">Home & Garden</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select value={urgency} onValueChange={(val) => setUrgency(val as 'low' | 'medium' | 'high')}>
                <SelectTrigger id="urgency">
                  <SelectValue placeholder="How urgent?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="medium">Medium - Would be nice soon</SelectItem>
                  <SelectItem value="high">High - Need it now</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Additional context (optional)</Label>
              <Textarea
                id="description"
                placeholder="Why do you want this? Any special circumstances?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            {quickCheckResult && (
              <div className={`p-4 rounded-lg ${
                quickCheckResult.canAfford
                  ? quickCheckResult.recommendation === 'easily_affordable'
                    ? 'bg-green-50 border border-green-200'
                    : quickCheckResult.recommendation === 'affordable'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {quickCheckResult.canAfford ? (
                    quickCheckResult.recommendation === 'stretch' ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    )
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {quickCheckResult.recommendation.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {quickCheckResult.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {quickCheckResult.percentageOfBudget.toFixed(1)}% of your discretionary budget
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleQuickCheck}
                disabled={!price || isLoadingQuickCheck || isLoadingDeliberation}
              >
                {isLoadingQuickCheck && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Quick Check
              </Button>
              <Button
                className="flex-1"
                onClick={handleAskTheBoard}
                disabled={isLoadingQuickCheck || isLoadingDeliberation}
              >
                {isLoadingDeliberation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                {isLoadingDeliberation ? 'Deliberating...' : 'Ask the Board'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Budget Status</CardTitle>
            <CardDescription>Current financial context</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Monthly Income</span>
              <span className="font-medium">{formatCurrency(financialSummary.monthlyIncome)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Fixed Expenses</span>
              <span className="font-medium">{formatCurrency(financialSummary.monthlyExpenses)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Bills</span>
              <span className="font-medium">{formatCurrency(financialSummary.monthlyBills)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Savings</span>
              <span className="font-medium">{formatCurrency(financialSummary.totalSavings)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium">Discretionary Budget</span>
              <span className="font-bold text-lg">{formatCurrency(financialSummary.discretionaryBudget)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
