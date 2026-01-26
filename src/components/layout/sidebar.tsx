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
  ArrowLeftRight,
  PlusCircle,
  History,
  Users,
  Settings,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Income', href: '/budget/income', icon: Wallet },
  { name: 'Expenses', href: '/budget/expenses', icon: Receipt },
  { name: 'Bills', href: '/budget/bills', icon: CreditCard },
  { name: 'Goals', href: '/budget/goals', icon: Target },
  { name: 'Savings', href: '/budget/savings', icon: PiggyBank },
  { name: 'Balancing', href: '/budget/balancing', icon: Scale },
  { name: 'New Purchase', href: '/deliberate', icon: PlusCircle },
  { name: 'History', href: '/history', icon: History },
  { name: 'Board', href: '/board', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-white dark:bg-slate-900 lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-2xl">💼</span>
        <span className="text-lg font-bold">Finance Bro Board</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
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
