'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CreditCard,
  Target,
  PiggyBank,
  PlusCircle,
  Users,
  Settings,
  Upload,
  ArrowLeftRight,
  GitBranch,
  HeartPulse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: 'MY BUDGET',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Financial Health', href: '/financial-health', icon: HeartPulse },
      { name: 'Income', href: '/budget/income', icon: Wallet },
      { name: 'Subscriptions', href: '/budget/expenses', icon: Receipt },
      { name: 'Bills', href: '/budget/bills', icon: CreditCard },
      { name: 'Goals', href: '/budget/goals', icon: Target },
      { name: 'Savings', href: '/budget/savings', icon: PiggyBank },
      { name: 'New Purchase', href: '/deliberate', icon: PlusCircle },
    ],
  },
  {
    title: 'BANK ANALYSIS',
    items: [
      { name: 'Import Statements', href: '/bank/import', icon: Upload },
      { name: 'Transactions', href: '/bank/transactions', icon: ArrowLeftRight },
      { name: 'Money Flow', href: '/bank/flow', icon: GitBranch },
    ],
  },
  {
    title: 'OTHER',
    items: [
      { name: 'Board', href: '/board', icon: Users },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white dark:bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-2xl">💼</span>
        <span className="text-lg font-bold">Finance Bro Board</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {navigation.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 p-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Board Status
          </p>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            17 Members Active
          </p>
        </div>
      </div>
    </aside>
  );
}

// Desktop sidebar wrapper with fixed positioning
export function DesktopSidebar() {
  return (
    <div className="fixed inset-y-0 left-0 z-50 hidden lg:block">
      <Sidebar />
    </div>
  );
}
