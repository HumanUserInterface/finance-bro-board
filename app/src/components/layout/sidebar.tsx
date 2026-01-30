"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Target,
  PiggyBank,
  HelpCircle,
  History,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Income",
    href: "/income",
    icon: Wallet,
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: Receipt,
  },
  {
    title: "Goals",
    href: "/goals",
    icon: Target,
  },
  {
    title: "Budget",
    href: "/budget",
    icon: PiggyBank,
  },
  {
    title: "Can I Afford?",
    href: "/decide",
    icon: HelpCircle,
  },
  {
    title: "History",
    href: "/history",
    icon: History,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <PiggyBank className="h-6 w-6" />
          <span>Finance Bro</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "justify-start gap-3 h-10",
                  isActive && "bg-secondary"
                )}
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="border-t p-2">
        <Button
          variant={pathname === "/settings" ? "secondary" : "ghost"}
          className="w-full justify-start gap-3 h-10"
          asChild
        >
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    </aside>
  )
}
