"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { PiggyBank, ArrowRight, Wallet, Receipt, Target, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    monthlyIncome: "",
    bills: [] as { name: string; amount: string }[],
    goalName: "",
    goalAmount: "",
  })
  const supabase = createClient()

  const progress = (step / 3) * 100

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as Step)
    }
  }

  const handleComplete = async () => {
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Save income if provided
      if (formData.monthlyIncome) {
        await supabase.from("income_sources").insert({
          user_id: user.id,
          name: "Monthly Salary",
          type: "salary" as const,
          amount: parseFloat(formData.monthlyIncome),
          frequency: "monthly" as const,
          is_active: true,
        })
      }

      // Save bills if provided
      for (const bill of formData.bills) {
        if (bill.name && bill.amount) {
          await supabase.from("bills").insert({
            user_id: user.id,
            name: bill.name,
            amount: parseFloat(bill.amount),
            due_day: 1,
            frequency: "monthly" as const,
            is_active: true,
          })
        }
      }

      // Save goal if provided
      if (formData.goalName && formData.goalAmount) {
        await supabase.from("savings_goals").insert({
          user_id: user.id,
          name: formData.goalName,
          type: "other" as const,
          target_amount: parseFloat(formData.goalAmount),
          current_amount: 0,
          is_active: true,
        })
      }

      // Mark onboarding as complete
      await supabase.from("profiles").update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", user.id)

      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Onboarding error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const addBill = () => {
    setFormData(prev => ({
      ...prev,
      bills: [...prev.bills, { name: "", amount: "" }]
    }))
  }

  const updateBill = (index: number, field: "name" | "amount", value: string) => {
    setFormData(prev => ({
      ...prev,
      bills: prev.bills.map((bill, i) =>
        i === index ? { ...bill, [field]: value } : bill
      )
    }))
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <PiggyBank className="h-8 w-8" />
          <span className="font-bold text-xl">Finance Bro</span>
        </div>
        <Progress value={progress} className="mb-4" />
        <CardTitle>
          {step === 1 && "Welcome! Let's get started"}
          {step === 2 && "What are your fixed costs?"}
          {step === 3 && "Set your first goal"}
        </CardTitle>
        <CardDescription>
          {step === 1 && "Tell us about your income"}
          {step === 2 && "Add your regular bills"}
          {step === 3 && "What are you saving for?"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Wallet className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="income">Monthly take-home pay</Label>
              <Input
                id="income"
                type="number"
                placeholder="e.g., 5000"
                value={formData.monthlyIncome}
                onChange={(e) => setFormData(prev => ({ ...prev, monthlyIncome: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                Your net income after taxes
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Receipt className="h-16 w-16 text-muted-foreground" />
            </div>
            {formData.bills.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">
                No bills added yet. Add your rent, utilities, subscriptions, etc.
              </p>
            ) : (
              formData.bills.map((bill, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Bill name"
                    value={bill.name}
                    onChange={(e) => updateBill(index, "name", e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    className="w-32"
                    value={bill.amount}
                    onChange={(e) => updateBill(index, "amount", e.target.value)}
                  />
                </div>
              ))
            )}
            <Button variant="outline" onClick={addBill} className="w-full">
              + Add a bill
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Target className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalName">What are you saving for?</Label>
              <Input
                id="goalName"
                placeholder="e.g., Emergency Fund, Vacation"
                value={formData.goalName}
                onChange={(e) => setFormData(prev => ({ ...prev, goalName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalAmount">Target amount</Label>
              <Input
                id="goalAmount"
                type="number"
                placeholder="e.g., 10000"
                value={formData.goalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, goalAmount: e.target.value }))}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((step - 1) as Step)}
              disabled={isLoading}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={handleNext} className="flex-1">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="flex-1" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Started
            </Button>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Step {step} of 3 • You can always update this later
        </p>
      </CardContent>
    </Card>
  )
}
