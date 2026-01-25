'use client';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          Welcome to Finance Bro Board
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          Let's set up your financial profile in 4 simple steps
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-2">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-2xl mb-2">
            💰
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Upload Your Paycheck
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We'll automatically extract your salary from your French paycheck PDF
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-2">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center text-2xl mb-2">
            🏠
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Add Social Benefits
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Include APL and Prime d'Activité if you receive them
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-2">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center text-2xl mb-2">
            📊
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Create Your Budget
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We'll suggest a 50/30/20 budget split that you can customize
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 space-y-2">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center text-2xl mb-2">
            🎯
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Set Savings Goals
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Allocate your savings to emergency funds and future projects
          </p>
        </div>
      </div>

      <div className="pt-6">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
