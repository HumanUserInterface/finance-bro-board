"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, LogOut, Settings, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Target,
  HelpCircle,
  History,
} from "lucide-react"

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Income", href: "/income", icon: Wallet },
  { title: "Expenses", href: "/expenses", icon: Receipt },
  { title: "Goals", href: "/goals", icon: Target },
  { title: "Budget", href: "/budget", icon: PiggyBank },
  { title: "Can I Afford?", href: "/decide", icon: HelpCircle },
  { title: "History", href: "/history", icon: History },
]

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Finance Bro
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-5rem)]">
            <nav className="flex flex-col gap-1 p-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn("justify-start gap-3 h-10")}
                    asChild
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  </Button>
                )
              })}
              <div className="my-2 border-t" />
              <Button
                variant={pathname === "/settings" ? "secondary" : "ghost"}
                className="justify-start gap-3 h-10"
                asChild
              >
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </nav>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Mobile logo */}
      <Link href="/dashboard" className="flex items-center gap-2 font-bold md:hidden">
        <PiggyBank className="h-5 w-5" />
        <span>Finance Bro</span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
