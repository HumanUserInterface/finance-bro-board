'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, Upload } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { MonthlyIncomeUpdate } from '@/components/monthly-income-update';

export function Header() {
  const router = useRouter();
  const supabase = createClient();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/80 px-6 backdrop-blur dark:bg-slate-900/80">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setUpdateDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Update Income</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>

      {/* Monthly Income Update Dialog */}
      <MonthlyIncomeUpdate
        isOpen={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        onUpdate={() => router.refresh()}
      />
    </header>
  );
}
