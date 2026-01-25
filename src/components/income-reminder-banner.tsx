'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Calendar } from 'lucide-react';

interface IncomeReminderBannerProps {
  onUpdateClick: () => void;
}

export function IncomeReminderBanner({ onUpdateClick }: IncomeReminderBannerProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    checkIncomeStatus();
  }, []);

  const checkIncomeStatus = async () => {
    try {
      // Check if dismissed in localStorage (valid for current session)
      const dismissed = sessionStorage.getItem('income-reminder-dismissed');
      if (dismissed) {
        setIsDismissed(true);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase
        .from('profiles')
        .select('monthly_income_last_updated')
        .eq('id', user.id)
        .single() as any);

      if (!profile) return;

      const lastUpdated = profile.monthly_income_last_updated;

      if (!lastUpdated) {
        // Never updated - show reminder
        setShouldShow(true);
        return;
      }

      // Check if more than 30 days old
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceUpdate >= 30) {
        setShouldShow(true);
      }
    } catch (error) {
      console.error('Error checking income status:', error);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('income-reminder-dismissed', 'true');
    setIsDismissed(true);
  };

  if (!shouldShow || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center">
            <Calendar className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Update Your Monthly Income
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            It's been a while since you updated your income. Keep your budget accurate by uploading
            your latest paycheck or updating your benefits.
          </p>
          <button
            onClick={onUpdateClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Update Now
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
