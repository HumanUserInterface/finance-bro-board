'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WelcomeStep } from './components/WelcomeStep';
import { PaycheckStep } from './components/PaycheckStep';
import { BenefitsStep } from './components/BenefitsStep';
import { BudgetStep } from './components/BudgetStep';

export interface OnboardingData {
  salary: number | null;
  apl: number;
  primeActivite: number;
  budgetCategories: BudgetCategory[];
}

export interface BudgetCategory {
  name: string;
  amount: number;
  type: 'need' | 'want' | 'saving';
  categoryType: 'fixed' | 'variable';
  isSavingsGoal?: boolean;
}

const STEPS = ['Welcome', 'Income', 'Benefits', 'Budget'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    salary: null,
    apl: 0,
    primeActivite: 0,
    budgetCategories: [],
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Redirect to dashboard after successful completion
    router.push('/dashboard');
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
      {/* Step Indicator */}
      <div className="bg-slate-100 dark:bg-slate-800 px-8 py-6">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    index <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-sm mt-2 font-medium ${
                    index <= currentStep
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-16 md:w-24 h-1 mx-4 mb-6 transition-colors ${
                    index < currentStep
                      ? 'bg-blue-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-8 md:p-12">
        {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
        {currentStep === 1 && (
          <PaycheckStep
            salary={data.salary}
            onSalaryChange={(salary) => updateData({ salary })}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 2 && (
          <BenefitsStep
            apl={data.apl}
            primeActivite={data.primeActivite}
            onAplChange={(apl) => updateData({ apl })}
            onPrimeActiviteChange={(primeActivite) => updateData({ primeActivite })}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 3 && (
          <BudgetStep
            totalIncome={(data.salary || 0) + data.apl + data.primeActivite}
            onComplete={handleComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
