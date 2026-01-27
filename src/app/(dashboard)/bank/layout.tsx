import { AlertTriangle } from 'lucide-react';

export default function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Disclaimer Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">Bank Statement Data</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Data imported from bank statements may contain inaccuracies: duplicate transactions,
            miscategorized items, or internal transfers. Use this section for analysis purposes.
            For accurate budgeting, use the &quot;My Budget&quot; section with manually entered data.
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}
