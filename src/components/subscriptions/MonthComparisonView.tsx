'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { getMonthlyTotals, getMonthDate, type MonthlyTotal } from '@/lib/services/subscription-months';

interface MonthComparisonViewProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentMonth: string;
  currency?: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Currency symbols mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
};

export function MonthComparisonView({
  isOpen,
  onClose,
  userId,
  currentMonth,
  currency = 'EUR',
}: MonthComparisonViewProps) {
  const currencySymbol = currencySymbols[currency] || currency;
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      loadComparison();
    }
  }, [isOpen, currentMonth]);

  const loadComparison = async () => {
    setIsLoading(true);

    // Generate last 6 months including current
    const months: string[] = [];
    const [year, month] = currentMonth.split('-').map(Number);

    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m < 1) {
        m += 12;
        y--;
      }
      months.push(getMonthDate(y, m));
    }

    const totals = await getMonthlyTotals(supabase, userId, months);
    setMonthlyTotals(totals);
    setIsLoading(false);
  };

  const formatMonth = (monthDate: string): string => {
    const [year, month] = monthDate.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  };

  const getMaxTotal = (): number => {
    if (monthlyTotals.length === 0) return 100;
    return Math.max(...monthlyTotals.map(m => m.total), 100);
  };

  const getTrend = (index: number): 'up' | 'down' | 'same' => {
    if (index === 0) return 'same';
    const current = monthlyTotals[index]?.total || 0;
    const previous = monthlyTotals[index - 1]?.total || 0;
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  };

  const getTrendChange = (index: number): number => {
    if (index === 0) return 0;
    const current = monthlyTotals[index]?.total || 0;
    const previous = monthlyTotals[index - 1]?.total || 0;
    return current - previous;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Subscription Cost Comparison</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Chart */}
              <div className="h-48 flex items-end gap-2">
                {monthlyTotals.map((month, index) => {
                  const heightPercent = (month.total / getMaxTotal()) * 100;
                  const isCurrentMonth = month.month === currentMonth;

                  return (
                    <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {currencySymbol}{month.total.toFixed(0)}
                      </div>
                      <div className="w-full h-32 flex items-end">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isCurrentMonth
                              ? 'bg-black dark:bg-white'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <div className={`text-xs text-center ${isCurrentMonth ? 'font-bold' : ''}`}>
                        {formatMonth(month.month)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold">Monthly Breakdown</h3>
                <div className="grid gap-2">
                  {monthlyTotals.map((month, index) => {
                    const trend = getTrend(index);
                    const change = getTrendChange(index);
                    const isCurrentMonth = month.month === currentMonth;

                    return (
                      <div
                        key={month.month}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isCurrentMonth
                            ? 'bg-slate-100 dark:bg-slate-800 border-2 border-black dark:border-white'
                            : 'bg-slate-50 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${isCurrentMonth ? 'font-bold' : ''}`}>
                            {formatMonth(month.month)}
                          </span>
                          {index > 0 && (
                            <span className={`flex items-center gap-1 text-sm ${
                              trend === 'up'
                                ? 'text-red-600 dark:text-red-400'
                                : trend === 'down'
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-muted-foreground'
                            }`}>
                              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                              {trend === 'same' && <Minus className="h-3 w-3" />}
                              {change !== 0 && (
                                <span>
                                  {change > 0 ? '+' : ''}{currencySymbol}{change.toFixed(2)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-muted-foreground">
                            <span className="text-green-600">{month.activeCount} active</span>
                            {month.pausedCount > 0 && (
                              <span className="ml-2 text-orange-600">{month.pausedCount} paused</span>
                            )}
                            {month.cancelledCount > 0 && (
                              <span className="ml-2 text-red-600">{month.cancelledCount} cancelled</span>
                            )}
                          </div>
                          <span className="font-semibold min-w-[80px] text-right">
                            {currencySymbol}{month.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary stats */}
              {monthlyTotals.length > 1 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {currencySymbol}{Math.min(...monthlyTotals.map(m => m.total)).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Lowest Month</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {currencySymbol}{(monthlyTotals.reduce((sum, m) => sum + m.total, 0) / monthlyTotals.length).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Average</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {currencySymbol}{Math.max(...monthlyTotals.map(m => m.total)).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Highest Month</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
