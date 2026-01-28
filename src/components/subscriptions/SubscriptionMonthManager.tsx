'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Tv, Music, Cloud, Gamepad2, Brain, Globe, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonthSelector } from './MonthSelector';
import { SubscriptionCard } from './SubscriptionCard';
import { MonthComparisonView } from './MonthComparisonView';
import {
  getSubscriptionsForMonth,
  updateSubscriptionStatus,
  updateSubscriptionAmount,
  cancelSubscription,
  reactivateSubscription,
  copyFromPreviousMonth,
  getMonthDate,
  type SubscriptionWithMonthState,
} from '@/lib/services/subscription-months';

interface SubscriptionMonthManagerProps {
  userId: string;
  currency?: string;
  onTotalChange?: (total: number) => void;
  onEditSubscription?: (subscription: SubscriptionWithMonthState) => void;
}

// Currency symbols mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
};

// Category icons mapping
const categoryIcons: Record<string, React.ElementType> = {
  streaming: Tv,
  music: Music,
  ai_tools: Brain,
  software: Cloud,
  gaming: Gamepad2,
  cloud_storage: Cloud,
  news_media: Globe,
  mobile_apps: Smartphone,
  other: CreditCard,
};

const categoryLabels: Record<string, string> = {
  streaming: 'Streaming',
  music: 'Music',
  ai_tools: 'AI Tools',
  software: 'Software',
  gaming: 'Gaming',
  cloud_storage: 'Cloud Storage',
  news_media: 'News & Media',
  mobile_apps: 'Mobile Apps',
  other: 'Other',
};

export function SubscriptionMonthManager({
  userId,
  currency = 'EUR',
  onTotalChange,
  onEditSubscription,
}: SubscriptionMonthManagerProps) {
  const now = new Date();
  const initialMonth = getMonthDate(now.getFullYear(), now.getMonth() + 1);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithMonthState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currencySymbol = currencySymbols[currency] || currency;
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);

  const supabase = createClient();

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true);
    const subs = await getSubscriptionsForMonth(supabase, userId, currentMonth);
    setSubscriptions(subs);

    // Check if this is a new month (no customizations yet)
    const hasCustomizations = subs.some(s => s.monthState !== null);
    setShowCopyButton(!hasCustomizations && subs.length > 0);

    // Calculate total and notify parent
    const total = calculateMonthlyTotal(subs);
    onTotalChange?.(total);

    setIsLoading(false);
  }, [supabase, userId, currentMonth, onTotalChange]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const calculateMonthlyTotal = (subs: SubscriptionWithMonthState[]): number => {
    return subs.reduce((total, sub) => {
      if (sub.effectiveStatus !== 'active') return total;
      const multipliers: Record<string, number> = {
        weekly: 4.33,
        biweekly: 2.17,
        monthly: 1,
        quarterly: 0.33,
        annually: 0.083,
      };
      return total + sub.effectiveAmount * (multipliers[sub.frequency || 'monthly'] || 1);
    }, 0);
  };

  const handleStatusChange = async (expenseId: string, status: 'active' | 'paused') => {
    setIsUpdating(expenseId);
    await updateSubscriptionStatus(supabase, userId, expenseId, currentMonth, status);
    await loadSubscriptions();
    setIsUpdating(null);
  };

  const handleAmountChange = async (expenseId: string, amount: number | null) => {
    setIsUpdating(expenseId);
    await updateSubscriptionAmount(supabase, userId, expenseId, currentMonth, amount);
    await loadSubscriptions();
    setIsUpdating(null);
  };

  const handleCancel = async (expenseId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription permanently? This will mark it as cancelled from this month onwards.')) {
      return;
    }
    setIsUpdating(expenseId);
    await cancelSubscription(supabase, userId, expenseId, currentMonth);
    await loadSubscriptions();
    setIsUpdating(null);
  };

  const handleReactivate = async (expenseId: string) => {
    setIsUpdating(expenseId);
    await reactivateSubscription(supabase, userId, expenseId);
    await loadSubscriptions();
    setIsUpdating(null);
  };

  const handleCopyFromPrevious = async () => {
    setIsLoading(true);
    await copyFromPreviousMonth(supabase, userId, currentMonth);
    await loadSubscriptions();
  };

  const handlePauseAllForMonth = async () => {
    const activeSubscriptions = subscriptions.filter(s => s.effectiveStatus === 'active');
    if (activeSubscriptions.length === 0) return;

    if (!confirm(`Pause all ${activeSubscriptions.length} subscriptions for this month?`)) {
      return;
    }
    setIsLoading(true);

    // Pause all active subscriptions for this month only
    for (const sub of activeSubscriptions) {
      await updateSubscriptionStatus(supabase, userId, sub.id, currentMonth, 'paused');
    }

    await loadSubscriptions();
  };

  const getCategoryFromNotes = (notes: string | null): string => {
    if (!notes) return 'other';
    const match = notes.match(/Category: (\w+)/);
    return match?.[1] || 'other';
  };

  // Group subscriptions by category
  const subscriptionsByCategory = subscriptions.reduce((acc, sub) => {
    const cat = getCategoryFromNotes(sub.notes);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(sub);
    return acc;
  }, {} as Record<string, SubscriptionWithMonthState[]>);

  const monthlyTotal = calculateMonthlyTotal(subscriptions);
  const activeCount = subscriptions.filter(s => s.effectiveStatus === 'active').length;
  const pausedCount = subscriptions.filter(s => s.effectiveStatus === 'paused').length;

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <MonthSelector
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onCopyFromPrevious={handleCopyFromPrevious}
        onCompareMonths={() => setShowComparison(true)}
        isLoading={isLoading}
        showCopyButton={showCopyButton}
      />

      {/* Summary for this month */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-black/10">
          <CardContent className="pt-6">
            <p className="text-sm font-medium uppercase tracking-widest text-black/40">This Month</p>
            <p className="text-3xl font-semibold tracking-tight mt-1">
              {currencySymbol}{monthlyTotal.toFixed(2)}
            </p>
            <p className="text-black/40 text-sm mt-1">
              {activeCount} active subscription{activeCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardContent className="pt-6">
            <p className="text-sm font-medium uppercase tracking-widest text-black/40">Paused</p>
            <p className="text-2xl font-semibold tracking-tight mt-1 text-orange-600 dark:text-orange-400">
              {pausedCount}
            </p>
            <p className="text-black/40 text-sm mt-1">
              subscription{pausedCount !== 1 ? 's' : ''} paused
            </p>
          </CardContent>
        </Card>
        <Card className="border-black/10">
          <CardContent className="pt-6">
            <p className="text-sm font-medium uppercase tracking-widest text-black/40">Yearly Projection</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">
              {currencySymbol}{(monthlyTotal * 12).toFixed(2)}
            </p>
            <p className="text-black/40 text-sm mt-1">
              based on this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pause All for this month button */}
      {subscriptions.filter(s => s.effectiveStatus === 'active').length > 0 && !isLoading && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePauseAllForMonth}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Pause All for This Month
          </Button>
        </div>
      )}

      {/* Subscriptions list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="w-8 h-8 mx-auto border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="mt-2">Loading subscriptions...</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscriptions yet.</p>
            <p className="text-sm text-muted-foreground">Add your first subscription to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(subscriptionsByCategory).map(([categoryKey, categorySubs]) => {
            const Icon = categoryIcons[categoryKey] || CreditCard;
            const categoryTotal = categorySubs
              .filter(s => s.effectiveStatus === 'active')
              .reduce((sum, s) => {
                const multipliers: Record<string, number> = {
                  weekly: 4.33,
                  monthly: 1,
                  quarterly: 0.33,
                  annually: 0.083,
                };
                return sum + s.effectiveAmount * (multipliers[s.frequency || 'monthly'] || 1);
              }, 0);

            return (
              <div key={categoryKey} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">{categoryLabels[categoryKey] || categoryKey}</h3>
                  <span className="text-sm text-muted-foreground">
                    {currencySymbol}{categoryTotal.toFixed(2)}/mo
                  </span>
                </div>
                <div className="space-y-2">
                  {categorySubs.map((subscription) => (
                    <SubscriptionCard
                      key={subscription.id}
                      subscription={subscription}
                      icon={Icon}
                      currency={currency}
                      onStatusChange={(status) => handleStatusChange(subscription.id, status)}
                      onAmountChange={(amount) => handleAmountChange(subscription.id, amount)}
                      onCancel={() => handleCancel(subscription.id)}
                      onReactivate={() => handleReactivate(subscription.id)}
                      onEdit={onEditSubscription ? () => onEditSubscription(subscription) : undefined}
                      isUpdating={isUpdating === subscription.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison modal */}
      <MonthComparisonView
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
        userId={userId}
        currentMonth={currentMonth}
        currency={currency}
      />
    </div>
  );
}
