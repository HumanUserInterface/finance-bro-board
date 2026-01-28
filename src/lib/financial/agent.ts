import { z } from 'zod';
import { complete } from '@/lib/llm/together';
import type { FinancialContext, FinancialAnalysis } from './types';

const FinancialInsightsSchema = z.object({
  budgetAssessment: z.string().describe('Assessment of how this purchase fits within the user\'s budget'),
  affordabilityVerdict: z.enum(['easily_affordable', 'affordable', 'stretch', 'risky', 'unaffordable']),
  keyFinancialConcerns: z.array(z.string()).describe('Specific financial concerns about this purchase'),
  spendingPatternInsights: z.array(z.string()).describe('Insights from spending patterns'),
  financialRecommendation: z.string().describe('Clear recommendation considering financial health'),
  riskFactors: z.array(z.string()).describe('Financial risk factors to consider'),
  alternativeSuggestions: z.array(z.string()).describe('Alternative approaches or timing suggestions'),
});

export type FinancialInsights = z.infer<typeof FinancialInsightsSchema>;

export async function getFinancialInsights(
  purchaseItem: string,
  purchasePrice: number,
  purchaseCategory: string,
  purchaseUrgency: string,
  context: FinancialContext,
  analysis: FinancialAnalysis
): Promise<FinancialInsights> {
  const prompt = `You are a financial analyst assistant. Analyze this purchase decision based on the user's financial situation.

PURCHASE REQUEST:
- Item: ${purchaseItem}
- Price: $${purchasePrice.toFixed(2)}
- Category: ${purchaseCategory}
- Urgency: ${purchaseUrgency}

FINANCIAL PROFILE:
- Monthly Income: $${context.monthlyIncome.toFixed(2)}
- Monthly Expenses: $${context.monthlyExpenses.toFixed(2)}
- Monthly Bills: $${context.monthlyBills.toFixed(2)}
- Discretionary Budget: $${context.discretionaryBudget.toFixed(2)}
- Total Savings: $${context.totalSavings.toFixed(2)}
- Total Debt: $${context.totalDebt.toFixed(2)}

FINANCIAL HEALTH:
- Health Score: ${analysis.health.score}/100 (${analysis.health.riskLevel} risk)
- Savings Rate: ${analysis.health.savingsRate.toFixed(1)}%
- Emergency Fund: ${analysis.health.emergencyFundMonths.toFixed(1)} months of expenses
- Debt-to-Income: ${(analysis.health.debtToIncomeRatio * 100).toFixed(1)}%

AFFORDABILITY METRICS:
- Purchase as % of Monthly Income: ${analysis.affordability.percentageOfMonthlyIncome.toFixed(1)}%
- Purchase as % of Discretionary Income: ${analysis.affordability.percentageOfDisposableIncome.toFixed(1)}%
- Purchase as % of Savings: ${analysis.affordability.percentageOfSavings.toFixed(1)}%
- System Assessment: ${analysis.affordability.recommendation.replace('_', ' ')}

SAVINGS GOALS:
${context.savingsGoals.map(g => `- ${g.name}: $${g.current.toFixed(0)}/$${g.target.toFixed(0)} (${g.progress.toFixed(0)}%)`).join('\n') || 'None set'}

${analysis.affordability.impactOnSavingsGoals.length > 0 ? `POTENTIAL IMPACT ON GOALS:\n${analysis.affordability.impactOnSavingsGoals.map(i => `- ${i}`).join('\n')}` : ''}

Provide a thorough financial analysis. Be direct and honest - if this purchase is financially risky, say so clearly.`;

  return complete<FinancialInsights>(
    [
      {
        role: 'system',
        content: 'You are a financial analyst. Provide objective, data-driven analysis. Be direct about financial risks.',
      },
      { role: 'user', content: prompt },
    ],
    FinancialInsightsSchema,
    0.5
  );
}
