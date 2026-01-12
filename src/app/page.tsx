import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-xl font-bold">Finance Bro Board</h1>
        <div className="space-x-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-5xl font-bold leading-tight">
            Your Personal Board of{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
              Financial Advisors
            </span>
          </h2>

          <p className="text-xl text-slate-300">
            17 AI board members with unique financial philosophies deliberate on every purchase you make.
            From the YOLO bro to the frugal saver, get diverse perspectives before you spend.
          </p>

          <div className="flex justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-3xl mb-4">💰</div>
            <h3 className="text-xl font-semibold mb-2">Budget Tracking</h3>
            <p className="text-slate-400">
              Track income, expenses, bills, and savings goals. The board knows your financial situation.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-3xl mb-4">👥</div>
            <h3 className="text-xl font-semibold mb-2">17 Board Members</h3>
            <p className="text-slate-400">
              From Chad Alpha to Frugal Frank, each member brings a unique perspective to your purchases.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="text-3xl mb-4">🧠</div>
            <h3 className="text-xl font-semibold mb-2">Smart Analysis</h3>
            <p className="text-slate-400">
              Each member researches, reasons, and self-critiques before casting their vote.
            </p>
          </div>
        </div>

        {/* Board Members Preview */}
        <div className="mt-32 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">Meet Your Board</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Chad Alpha', title: 'Chief Gains Officer', emoji: '😎' },
              { name: 'Frugal Frank', title: 'Chief Penny Pincher', emoji: '💰' },
              { name: 'Warren Boomer', title: 'Chief Value Officer', emoji: '📈' },
              { name: 'Crypto Kyle', title: 'Chief Disruption Officer', emoji: '🪙' },
              { name: 'YOLO Yolanda', title: 'Chief Experience Officer', emoji: '🎉' },
              { name: 'Index Irene', title: 'Chief Simplicity Officer', emoji: '📊' },
              { name: 'Debt-Free Derek', title: 'Chief Liberation Officer', emoji: '🔓' },
              { name: 'Minimalist Maya', title: 'Chief Declutter Officer', emoji: '✨' },
            ].map((member) => (
              <div
                key={member.name}
                className="bg-slate-800/30 rounded-lg p-4 text-center border border-slate-700/50"
              >
                <div className="text-3xl mb-2">{member.emoji}</div>
                <div className="font-medium text-sm">{member.name}</div>
                <div className="text-xs text-slate-500">{member.title}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 mt-4">...and 9 more unique perspectives</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t border-slate-800">
        <p className="text-center text-slate-500">
          Finance Bro Board - Your AI Financial Advisory Board
        </p>
      </footer>
    </div>
  );
}
