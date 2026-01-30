import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PiggyBank, TrendingUp, Target, Users } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <PiggyBank className="h-6 w-6" />
            Finance Bro
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Make smarter financial decisions
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Track your budget, set savings goals, and get AI-powered advice from a board of 7 financial personas before making any purchase.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Track Everything</h3>
              <p className="text-muted-foreground">
                Income, expenses, bills, and subscriptions - all in one place.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Set Goals</h3>
              <p className="text-muted-foreground">
                Create savings goals and track your progress toward financial freedom.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Deliberation</h3>
              <p className="text-muted-foreground">
                7 AI personas debate your purchases to help you decide wisely.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built with Next.js, Supabase, and Together.ai
        </div>
      </footer>
    </div>
  )
}
