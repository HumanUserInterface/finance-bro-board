import type {
  FinancialContext,
  FinancialHealth,
  AffordabilityAssessment,
  SpendingPattern,
  FinancialAnalysis,
  RiskLevel,
} from './types';

export function calculateFinancialHealth(context: FinancialContext): FinancialHealth {
  const { monthlyIncome, monthlyExpenses, monthlyBills, totalSavings, totalDebt } = context;

  const totalMonthlyOutflow = monthlyExpenses + monthlyBills;
  const monthlyDisposableIncome = monthlyIncome - totalMonthlyOutflow;

  // Savings rate
  const savingsRate = monthlyIncome > 0
    ? (monthlyDisposableIncome / monthlyIncome) * 100
    : 0;

  // Debt-to-income ratio (annual)
  const debtToIncomeRatio = monthlyIncome > 0
    ? totalDebt / (monthlyIncome * 12)
    : 0;

  // Emergency fund coverage
  const emergencyFundMonths = totalMonthlyOutflow > 0
    ? totalSavings / totalMonthlyOutflow
    : 0;

  // Calculate health score (0-100)
  let score = 50;

  // Savings rate impact (+/- 25 points)
  if (savingsRate >= 20) score += 25;
  else if (savingsRate >= 10) score += 15;
  else if (savingsRate >= 5) score += 5;
  else if (savingsRate < 0) score -= 25;
  else score -= 10;

  // Debt-to-income impact (+/- 15 points)
  if (debtToIncomeRatio === 0) score += 15;
  else if (debtToIncomeRatio < 0.2) score += 10;
  else if (debtToIncomeRatio < 0.36) score += 0;
  else if (debtToIncomeRatio < 0.5) score -= 10;
  else score -= 15;

  // Emergency fund impact (+/- 10 points)
  if (emergencyFundMonths >= 6) score += 10;
  else if (emergencyFundMonths >= 3) score += 5;
  else if (emergencyFundMonths < 1) score -= 10;

  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let riskLevel: RiskLevel;
  if (score >= 70) riskLevel = 'low';
  else if (score >= 50) riskLevel = 'moderate';
  else if (score >= 30) riskLevel = 'high';
  else riskLevel = 'critical';

  // Generate recommendations
  const recommendations: string[] = [];

  if (savingsRate < 20) {
    recommendations.push('Aim to save at least 20% of your income');
  }
  if (debtToIncomeRatio > 0.36) {
    recommendations.push('Focus on reducing debt - your debt-to-income ratio is high');
  }
  if (emergencyFundMonths < 3) {
    recommendations.push('Build an emergency fund covering 3-6 months of expenses');
  }
  if (monthlyDisposableIncome < 0) {
    recommendations.push('Your expenses exceed income - review your budget urgently');
  }
  if (context.savingsGoals.some(g => g.progress < 25)) {
    recommendations.push('Some savings goals are behind - consider increasing contributions');
  }

  return {
    score,
    riskLevel,
    savingsRate,
    debtToIncomeRatio,
    monthlyDisposableIncome,
    emergencyFundMonths,
    recommendations,
  };
}

export function assessAffordability(
  purchasePrice: number,
  context: FinancialContext,
  health: FinancialHealth
): AffordabilityAssessment {
  const { monthlyIncome, totalSavings, savingsGoals } = context;
  const { monthlyDisposableIncome } = health;

  const percentageOfMonthlyIncome = monthlyIncome > 0
    ? (purchasePrice / monthlyIncome) * 100
    : 999;

  const percentageOfDisposableIncome = monthlyDisposableIncome > 0
    ? (purchasePrice / monthlyDisposableIncome) * 100
    : 999;

  const percentageOfSavings = totalSavings > 0
    ? (purchasePrice / totalSavings) * 100
    : 999;

  // Check impact on savings goals
  const impactOnSavingsGoals: string[] = [];
  for (const goal of savingsGoals) {
    if (goal.progress < 100) {
      const remaining = goal.target - goal.current;
      if (purchasePrice > remaining * 0.1) {
        impactOnSavingsGoals.push(`May delay "${goal.name}" goal (${goal.progress.toFixed(0)}% complete)`);
      }
    }
  }

  // Determine recommendation
  let recommendation: AffordabilityAssessment['recommendation'];
  let recommendationReason: string;
  let canAfford: boolean;

  if (percentageOfMonthlyIncome <= 5 && percentageOfSavings <= 2) {
    recommendation = 'easily_affordable';
    recommendationReason = 'This purchase is well within your means';
    canAfford = true;
  } else if (percentageOfMonthlyIncome <= 15 && percentageOfSavings <= 10) {
    recommendation = 'affordable';
    recommendationReason = 'This purchase is affordable but will use a notable portion of your budget';
    canAfford = true;
  } else if (percentageOfMonthlyIncome <= 30 && percentageOfDisposableIncome <= 100) {
    recommendation = 'stretch';
    recommendationReason = 'This purchase is a stretch - consider if it\'s truly necessary';
    canAfford = true;
  } else if (percentageOfSavings <= 30 || percentageOfMonthlyIncome <= 50) {
    recommendation = 'not_recommended';
    recommendationReason = 'This purchase would significantly impact your financial health';
    canAfford = false;
  } else {
    recommendation = 'unaffordable';
    recommendationReason = 'This purchase is beyond your current financial capacity';
    canAfford = false;
  }

  // Override if health is already poor
  if (health.riskLevel === 'critical' && recommendation !== 'easily_affordable') {
    recommendation = 'not_recommended';
    recommendationReason = 'Your financial health is critical - focus on essentials only';
    canAfford = false;
  }

  return {
    canAfford,
    percentageOfMonthlyIncome,
    percentageOfDisposableIncome,
    percentageOfSavings,
    impactOnSavingsGoals,
    recommendation,
    recommendationReason,
  };
}

export function analyzeSpendingPatterns(
  transactions: Array<{ description: string; amount: number; category: string; date: string }>,
  totalExpenses: number
): SpendingPattern[] {
  if (transactions.length === 0) return [];

  const categoryMap = new Map<string, { total: number; count: number; amounts: number[] }>();

  for (const tx of transactions) {
    const existing = categoryMap.get(tx.category) ?? { total: 0, count: 0, amounts: [] };
    categoryMap.set(tx.category, {
      total: existing.total + tx.amount,
      count: existing.count + 1,
      amounts: [...existing.amounts, tx.amount],
    });
  }

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      totalSpent: data.total,
      transactionCount: data.count,
      averageTransaction: data.total / data.count,
      percentageOfExpenses: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      trend: 'stable' as const, // Would need historical data to calculate actual trend
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export function generateFinancialAnalysis(
  purchasePrice: number,
  context: FinancialContext
): FinancialAnalysis {
  const health = calculateFinancialHealth(context);
  const affordability = assessAffordability(purchasePrice, context, health);
  const spendingPatterns = analyzeSpendingPatterns(
    context.recentTransactions,
    context.monthlyExpenses
  );

  // Generate summary
  const summaryParts: string[] = [];

  summaryParts.push(`Financial health score: ${health.score}/100 (${health.riskLevel} risk).`);

  if (affordability.canAfford) {
    summaryParts.push(`This purchase is ${affordability.recommendation.replace('_', ' ')}.`);
  } else {
    summaryParts.push(`This purchase is ${affordability.recommendation.replace('_', ' ')}.`);
  }

  summaryParts.push(affordability.recommendationReason);

  if (affordability.impactOnSavingsGoals.length > 0) {
    summaryParts.push(`Note: ${affordability.impactOnSavingsGoals[0]}`);
  }

  return {
    health,
    affordability,
    spendingPatterns,
    summary: summaryParts.join(' '),
  };
}
