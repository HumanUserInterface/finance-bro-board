'use client';

import { ChevronLeft, ChevronRight, Copy, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthSelectorProps {
  currentMonth: string; // Format: YYYY-MM-01
  onMonthChange: (month: string) => void;
  onCopyFromPrevious: () => void;
  onCompareMonths: () => void;
  isLoading?: boolean;
  showCopyButton?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthSelector({
  currentMonth,
  onMonthChange,
  onCopyFromPrevious,
  onCompareMonths,
  isLoading = false,
  showCopyButton = false
}: MonthSelectorProps) {
  const [year, month] = currentMonth.split('-').map(Number);

  const goToPreviousMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}-01`);
  };

  const goToNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    onMonthChange(`${newYear}-${String(newMonth).padStart(2, '0')}-01`);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    onMonthChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-[160px] text-center">
          <span className="text-lg font-semibold">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          disabled={isLoading}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentMonth() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToCurrentMonth}
            disabled={isLoading}
            className="text-muted-foreground text-sm"
          >
            Today
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showCopyButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyFromPrevious}
            disabled={isLoading}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy from Previous
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onCompareMonths}
          disabled={isLoading}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Compare
        </Button>
      </div>
    </div>
  );
}
