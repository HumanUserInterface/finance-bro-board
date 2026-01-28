'use client';

import { useState } from 'react';
import { Pause, Play, X, Pencil, Check, RotateCcw, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionWithMonthState } from '@/lib/services/subscription-months';

interface SubscriptionCardProps {
  subscription: SubscriptionWithMonthState;
  icon: React.ElementType;
  currency?: string;
  onStatusChange: (status: 'active' | 'paused') => void;
  onAmountChange: (amount: number | null) => void;
  onCancel: () => void;
  onReactivate?: () => void;
  onEdit?: () => void;
  isUpdating?: boolean;
}

// Currency symbols mapping
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
};

export function SubscriptionCard({
  subscription,
  icon: Icon,
  currency = 'EUR',
  onStatusChange,
  onAmountChange,
  onCancel,
  onReactivate,
  onEdit,
  isUpdating = false,
}: SubscriptionCardProps) {
  const currencySymbol = currencySymbols[currency] || currency;
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState(subscription.effectiveAmount.toString());

  const isPaused = subscription.effectiveStatus === 'paused';
  const isCancelled = subscription.effectiveStatus === 'cancelled';
  const hasAmountOverride = subscription.monthState?.amount_override !== null && subscription.monthState?.amount_override !== undefined;

  const handleToggleStatus = () => {
    if (isCancelled) return;
    onStatusChange(isPaused ? 'active' : 'paused');
  };

  const handleSaveAmount = () => {
    const newAmount = parseFloat(editedAmount);
    if (!isNaN(newAmount) && newAmount >= 0) {
      // If amount matches original, remove override
      if (newAmount === subscription.amount) {
        onAmountChange(null);
      } else {
        onAmountChange(newAmount);
      }
    }
    setIsEditingAmount(false);
  };

  const handleResetAmount = () => {
    onAmountChange(null);
    setEditedAmount(subscription.amount.toString());
  };

  const getMonthlyEquivalent = (amount: number, frequency: string | null): number => {
    const multipliers: Record<string, number> = {
      weekly: 4.33,
      biweekly: 2.17,
      monthly: 1,
      quarterly: 0.33,
      annually: 0.083,
    };
    return amount * (multipliers[frequency || 'monthly'] || 1);
  };

  const frequencyLabels: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    annually: 'Annually',
  };

  return (
    <Card className={`border transition-all ${
      isCancelled
        ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 opacity-60'
        : isPaused
          ? 'border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20'
          : 'border-slate-200 dark:border-slate-800'
    }`}>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            isCancelled
              ? 'bg-red-100 dark:bg-red-900'
              : isPaused
                ? 'bg-orange-100 dark:bg-orange-900'
                : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            <Icon className={`h-4 w-4 ${
              isCancelled
                ? 'text-red-600 dark:text-red-400'
                : isPaused
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-slate-600 dark:text-slate-400'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                {subscription.name}
              </p>
              {isPaused && (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800 text-xs">
                  Paused
                </Badge>
              )}
              {isCancelled && (
                <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800 text-xs">
                  Cancelled
                </Badge>
              )}
              {hasAmountOverride && !isCancelled && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs">
                  Modified
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {frequencyLabels[subscription.frequency || 'monthly']}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Amount display/edit */}
          <div className="text-right min-w-[100px]">
            {isEditingAmount ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                <Input
                  type="number"
                  value={editedAmount}
                  onChange={(e) => setEditedAmount(e.target.value)}
                  className="w-20 h-7 text-sm"
                  step="0.01"
                  min="0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAmount();
                    if (e.key === 'Escape') setIsEditingAmount(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleSaveAmount}
                  disabled={isUpdating}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <p className={`font-semibold ${
                  isCancelled ? 'text-muted-foreground line-through' : ''
                } ${hasAmountOverride ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {currencySymbol}{subscription.effectiveAmount.toFixed(2)}
                  {hasAmountOverride && (
                    <span className="text-xs text-muted-foreground line-through ml-1">
                      {currencySymbol}{subscription.amount.toFixed(2)}
                    </span>
                  )}
                </p>
                {subscription.frequency !== 'monthly' && !isCancelled && (
                  <p className="text-xs text-muted-foreground">
                    {currencySymbol}{getMonthlyEquivalent(subscription.effectiveAmount, subscription.frequency).toFixed(2)}/mo
                  </p>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            {!isCancelled && (
              <>
                {/* Toggle pause/active */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleToggleStatus}
                  disabled={isUpdating}
                  title={isPaused ? 'Resume subscription' : 'Pause subscription'}
                >
                  {isPaused ? (
                    <Play className="h-3 w-3 text-green-600" />
                  ) : (
                    <Pause className="h-3 w-3 text-orange-600" />
                  )}
                </Button>

                {/* Edit amount */}
                {!isEditingAmount && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsEditingAmount(true)}
                    disabled={isUpdating}
                    title="Edit amount for this month"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}

                {/* Reset amount override */}
                {hasAmountOverride && !isEditingAmount && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleResetAmount}
                    disabled={isUpdating}
                    title="Reset to original amount"
                  >
                    <RotateCcw className="h-3 w-3 text-blue-600" />
                  </Button>
                )}

                {/* Edit subscription details */}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onEdit}
                    disabled={isUpdating}
                    title="Edit subscription details"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                )}

                {/* Cancel subscription */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onCancel}
                  disabled={isUpdating}
                  title="Cancel subscription permanently"
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </>
            )}

            {/* Reactivate cancelled subscription */}
            {isCancelled && onReactivate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReactivate}
                disabled={isUpdating}
                className="gap-1 text-green-600 hover:text-green-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reactivate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
