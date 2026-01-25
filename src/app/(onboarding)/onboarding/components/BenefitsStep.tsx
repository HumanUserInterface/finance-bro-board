'use client';

import { useState } from 'react';
import { Home, Briefcase } from 'lucide-react';

interface BenefitsStepProps {
  apl: number;
  primeActivite: number;
  onAplChange: (apl: number) => void;
  onPrimeActiviteChange: (primeActivite: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BenefitsStep({
  apl,
  primeActivite,
  onAplChange,
  onPrimeActiviteChange,
  onNext,
  onBack,
}: BenefitsStepProps) {
  const [aplInput, setAplInput] = useState(apl.toString());
  const [primeInput, setPrimeInput] = useState(primeActivite.toString());
  const [showAplInfo, setShowAplInfo] = useState(false);
  const [showPrimeInfo, setShowPrimeInfo] = useState(false);

  const handleAplChange = (value: string) => {
    setAplInput(value);
    const parsed = parseFloat(value) || 0;
    onAplChange(Math.max(0, parsed));
  };

  const handlePrimeChange = (value: string) => {
    setPrimeInput(value);
    const parsed = parseFloat(value) || 0;
    onPrimeActiviteChange(Math.max(0, parsed));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          French Social Benefits
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Do you receive any housing aid or activity bonuses? Add them here to get an accurate
          budget.
        </p>
      </div>

      {/* APL Input */}
      <div className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <Home className="h-6 w-6 text-white dark:text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  APL (Aide Personnalisée au Logement)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Housing assistance</p>
              </div>
            </div>
            <button
              onClick={() => setShowAplInfo(!showAplInfo)}
              className="text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white text-sm font-medium"
            >
              {showAplInfo ? 'Hide' : 'Learn more'}
            </button>
          </div>

          {showAplInfo && (
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-lg p-4">
              APL is a French housing benefit that helps cover rent costs for eligible individuals.
              It's calculated based on your income, rent amount, and household composition. Enter
              the monthly amount you receive.
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Monthly APL Amount (€)
            </label>
            <input
              type="number"
              value={aplInput}
              onChange={(e) => handleAplChange(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
            />
          </div>
        </div>

        {/* Prime d'Activité Input */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-white dark:text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Prime d'Activité
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Activity bonus</p>
              </div>
            </div>
            <button
              onClick={() => setShowPrimeInfo(!showPrimeInfo)}
              className="text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white text-sm font-medium"
            >
              {showPrimeInfo ? 'Hide' : 'Learn more'}
            </button>
          </div>

          {showPrimeInfo && (
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-lg p-4">
              Prime d'Activité is a French benefit for low-income workers designed to supplement
              earnings. It's calculated based on your income, household composition, and other
              factors. Enter the monthly amount you receive.
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Monthly Prime d'Activité Amount (€)
            </label>
            <input
              type="number"
              value={primeInput}
              onChange={(e) => handlePrimeChange(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {(apl > 0 || primeActivite > 0) && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Total benefits:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              €{(apl + primeActivite).toFixed(2)}/month
            </span>
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 font-semibold rounded-lg transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
