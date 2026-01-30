export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface FinancialHealth {
  score: number; // 0-100
  riskLevel: RiskLevel;
  savingsRate: number; // percentage of income saved
  debtToIncomeRatio: number;
  monthlyDisposableIncome: number;
  emergencyFundMonths: number; // months of expenses covered by savings
  recommendations: string[];
}

export interface AffordabilityAssessment {
  canAfford: boolean;
  percentageOfMonthlyIncome: number;
  percentageOfDisposableIncome: number;
  percentageOfSavings: number;
  impactOnSavingsGoals: string[];
  recommendation: 'easily_affordable' | 'affordable' | 'stretch' | 'not_recommended' | 'unaffordable';
  recommendationReason: string;
}

export interface SpendingPattern {
  category: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  percentageOfExpenses: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface FinancialAnalysis {
  health: FinancialHealth;
  affordability: AffordabilityAssessment;
  spendingPatterns: SpendingPattern[];
  summary: string;
}

export interface FinancialContext {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBills: number;
  discretionaryBudget: number;
  totalSavings: number;
  totalDebt: number;
  savingsGoals: Array<{ name: string; target: number; current: number; progress: number }>;
  incomeBreakdown: Array<{ name: string; amount: number; frequency: string }>;
  expenseBreakdown: Array<{ name: string; amount: number; type: string }>;
  recentTransactions: Array<{ description: string; amount: number; category: string; date: string }>;
}

export interface EnrichedFinancialContext extends FinancialContext {
  analysis: FinancialAnalysis;
}
