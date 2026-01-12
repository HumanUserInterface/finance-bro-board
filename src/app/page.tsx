import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="container mx-auto px-6 py-8 flex justify-between items-center border-b border-black/10">
        <h1 className="text-lg font-semibold tracking-tight">Finance Bro Board</h1>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm hover:underline underline-offset-4">
            Login
          </Link>
          <Link href="/signup">
            <Button className="rounded-none px-6">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center py-32 space-y-8">
          <h2 className="text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight">
            Your Personal Board of Financial Advisors
          </h2>

          <p className="text-lg text-black/60 max-w-xl mx-auto leading-relaxed">
            17 AI board members with unique financial philosophies deliberate on every purchase you make.
          </p>

          <div className="pt-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-none px-12 py-6 text-base">
                Start Free
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="border-t border-black/10 py-24">
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <div className="space-y-4">
              <div className="text-xs font-medium tracking-widest uppercase text-black/40">01</div>
              <h3 className="text-xl font-medium">Budget Tracking</h3>
              <p className="text-black/60 leading-relaxed">
                Track income, expenses, bills, and savings goals. The board knows your financial situation.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-medium tracking-widest uppercase text-black/40">02</div>
              <h3 className="text-xl font-medium">17 Board Members</h3>
              <p className="text-black/60 leading-relaxed">
                From Chad Alpha to Frugal Frank, each member brings a unique perspective to your purchases.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-xs font-medium tracking-widest uppercase text-black/40">03</div>
              <h3 className="text-xl font-medium">Smart Analysis</h3>
              <p className="text-black/60 leading-relaxed">
                Each member researches, reasons, and self-critiques before casting their vote.
              </p>
            </div>
          </div>
        </div>

        {/* Board Members Preview */}
        <div className="border-t border-black/10 py-24">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium tracking-widest uppercase text-black/40 text-center mb-12">
              Meet Your Board
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/10">
              {[
                { name: 'Chad Alpha', title: 'Chief Gains Officer' },
                { name: 'Frugal Frank', title: 'Chief Penny Pincher' },
                { name: 'Warren Boomer', title: 'Chief Value Officer' },
                { name: 'Crypto Kyle', title: 'Chief Disruption Officer' },
                { name: 'YOLO Yolanda', title: 'Chief Experience Officer' },
                { name: 'Index Irene', title: 'Chief Simplicity Officer' },
                { name: 'Debt-Free Derek', title: 'Chief Liberation Officer' },
                { name: 'Minimalist Maya', title: 'Chief Declutter Officer' },
              ].map((member) => (
                <div
                  key={member.name}
                  className="bg-white p-6 text-center"
                >
                  <div className="font-medium text-sm">{member.name}</div>
                  <div className="text-xs text-black/40 mt-1">{member.title}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-black/40 text-sm mt-8">+ 9 more unique perspectives</p>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-black/10 py-24">
          <div className="text-center space-y-6">
            <h3 className="text-3xl font-medium">Ready to make smarter decisions?</h3>
            <Link href="/signup">
              <Button size="lg" className="rounded-none px-12 py-6 text-base">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-black/10">
        <p className="text-center text-black/40 text-sm">
          Finance Bro Board
        </p>
      </footer>
    </div>
  );
}
