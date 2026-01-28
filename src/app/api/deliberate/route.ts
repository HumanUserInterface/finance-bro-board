import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { complete } from '@/lib/llm/together';
import { getBuiltInPersonas, type Persona } from '@/lib/personas';
import {
  type FinancialContext,
  type FinancialAnalysis,
  generateFinancialAnalysis,
  getFinancialInsights,
  type FinancialInsights,
} from '@/lib/financial';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schemas for agent responses
const ResearchSchema = z.object({
  marketContext: z.string(),
  priceAnalysis: z.string(),
  alternatives: z.array(z.string()),
  keyConsiderations: z.array(z.string()),
});

const ReasoningSchema = z.object({
  prosFromMyPerspective: z.array(z.string()),
  consFromMyPerspective: z.array(z.string()),
  alignmentWithValues: z.string(),
  initialLeaning: z.enum(['approve', 'reject', 'unsure']),
  confidenceLevel: z.number().min(0).max(100),
});

const CritiqueSchema = z.object({
  blindSpotsIdentified: z.array(z.string()),
  counterArguments: z.array(z.string()),
  revisedPosition: z.enum(['approve', 'reject']),
  finalConfidence: z.number().min(0).max(100),
});

const VoteSchema = z.object({
  vote: z.enum(['approve', 'reject']),
  reasoning: z.string().describe('A clear 2-3 sentence justification explaining WHY you are voting this way. Reference specific numbers (price, budget %, savings impact) and your unique perspective. Do NOT just say "good value" - explain the specific financial reasoning.'),
  confidence: z.number().min(0).max(100),
  keyFactors: z.array(z.string()).describe('The 2-3 most important factors that drove your decision'),
  catchphrase: z.string().describe('One of your signature catchphrases that fits this decision'),
});

async function getFinancialContext(userId: string): Promise<FinancialContext> {
  // Fetch all financial data in parallel (only manually entered data, not bank statements)
  const [incomeRes, expensesRes, billsRes, goalsRes, accountsRes] = await Promise.all([
    supabase.from('income_sources').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('bills').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('savings_goals').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('savings_accounts').select('*').eq('user_id', userId).eq('is_active', true),
  ]);

  const incomes = incomeRes.data || [];
  const expenses = expensesRes.data || [];
  const bills = billsRes.data || [];
  const goals = goalsRes.data || [];
  const accounts = accountsRes.data || [];

  // Calculate monthly totals
  const frequencyMultipliers: Record<string, number> = {
    weekly: 4.33,
    biweekly: 2.17,
    monthly: 1,
    quarterly: 0.33,
    annually: 0.083,
    one_time: 0,
  };

  const monthlyIncome = incomes.reduce((total, inc) => {
    return total + inc.amount * (frequencyMultipliers[inc.frequency] || 0);
  }, 0);

  // Only count fixed recurring expenses (subscriptions), not variable budget allocations (wants)
  const monthlyExpenses = expenses
    .filter((e) => e.is_recurring && e.type === 'fixed')
    .reduce((total, exp) => {
      return total + exp.amount * (frequencyMultipliers[exp.frequency || 'monthly'] || 0);
    }, 0);

  const monthlyBills = bills.reduce((total, bill) => {
    return total + bill.amount * (frequencyMultipliers[bill.frequency] || 0);
  }, 0);

  const discretionaryBudget = monthlyIncome - monthlyExpenses - monthlyBills;

  // Total savings from both goals and accounts
  const savingsFromGoals = goals.reduce((total, goal) => total + goal.current_amount, 0);
  const savingsFromAccounts = accounts
    .filter(a => a.type === 'savings' || a.type === 'checking')
    .reduce((total, acc) => total + acc.balance, 0);
  const totalSavings = savingsFromGoals + savingsFromAccounts;

  // Estimate debt (could be expanded with a debt table in the future)
  const totalDebt = 0; // Placeholder - would need debt tracking table

  const savingsGoals = goals.map((goal) => ({
    name: goal.name,
    target: goal.target_amount,
    current: goal.current_amount,
    progress: goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0,
  }));

  const incomeBreakdown = incomes.map((inc) => ({
    name: inc.name,
    amount: inc.amount,
    frequency: inc.frequency,
  }));

  const expenseBreakdown = expenses.map((exp) => ({
    name: exp.name,
    amount: exp.amount,
    type: exp.type,
  }));

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyBills,
    discretionaryBudget,
    totalSavings,
    totalDebt,
    savingsGoals,
    incomeBreakdown,
    expenseBreakdown,
    recentTransactions: [], // Not using bank transactions, only manual data
  };
}

interface BoardMemberResult {
  personaSlug: string;
  personaName: string;
  research: z.infer<typeof ResearchSchema>;
  reasoning: z.infer<typeof ReasoningSchema>;
  critique: z.infer<typeof CritiqueSchema>;
  vote: z.infer<typeof VoteSchema>;
}

async function runBoardMember(
  persona: Persona,
  purchaseItem: string,
  purchasePrice: number,
  purchaseCategory: string,
  purchaseDescription: string | null,
  purchaseUrgency: string,
  purchaseContext: string | null,
  financialContext: FinancialContext,
  financialAnalysis: FinancialAnalysis,
  financialInsights: FinancialInsights
): Promise<BoardMemberResult> {
  const budgetPercentage = financialContext.discretionaryBudget > 0
    ? ((purchasePrice / financialContext.discretionaryBudget) * 100).toFixed(1)
    : 'N/A';

  const financialSummary = `
FINANCIAL CONTEXT:
- Monthly Income: $${financialContext.monthlyIncome.toFixed(2)}
- Monthly Expenses: $${financialContext.monthlyExpenses.toFixed(2)}
- Monthly Bills: $${financialContext.monthlyBills.toFixed(2)}
- Discretionary Budget: $${financialContext.discretionaryBudget.toFixed(2)}
- Total Savings: $${financialContext.totalSavings.toFixed(2)}
- Savings Goals: ${financialContext.savingsGoals.map((g) => `${g.name} (${g.progress.toFixed(0)}%)`).join(', ') || 'None'}

FINANCIAL HEALTH ASSESSMENT:
- Health Score: ${financialAnalysis.health.score}/100 (${financialAnalysis.health.riskLevel} risk)
- Savings Rate: ${financialAnalysis.health.savingsRate.toFixed(1)}%
- Emergency Fund: ${financialAnalysis.health.emergencyFundMonths.toFixed(1)} months of expenses
- Affordability: ${financialAnalysis.affordability.recommendation.replace('_', ' ')}

PURCHASE IMPACT:
- This purchase represents ${budgetPercentage}% of monthly discretionary budget
- ${financialAnalysis.affordability.percentageOfSavings.toFixed(1)}% of total savings
- Assessment: ${financialInsights.affordabilityVerdict.replace('_', ' ')}

KEY FINANCIAL CONCERNS:
${financialInsights.keyFinancialConcerns.map(c => `- ${c}`).join('\n') || '- None identified'}

FINANCIAL RECOMMENDATION:
${financialInsights.financialRecommendation}
`;

  const purchaseSummary = `
PURCHASE REQUEST:
- Item: ${purchaseItem}
- Price: $${purchasePrice.toFixed(2)}
- Category: ${purchaseCategory}
- Urgency: ${purchaseUrgency}
${purchaseDescription ? `- Description: ${purchaseDescription}` : ''}
${purchaseContext ? `- Additional Context: ${purchaseContext}` : ''}
`;

  const personaPrompt = `
You are ${persona.name}, the ${persona.title}.
Archetype: ${persona.archetype}
Backstory: ${persona.backstory}

Your investment style: ${persona.traits.investmentStyle}
Risk tolerance: ${persona.traits.riskTolerance}
Favorite metrics: ${persona.traits.favoriteMetrics.join(', ')}
Pet peeves: ${persona.traits.petPeeves.join(', ')}
Known biases: ${persona.traits.biases.join(', ')}
Catchphrases: ${persona.traits.catchphrases.join(' | ')}

Decision Framework: ${persona.decisionFramework}
Voice: ${persona.voiceDescription}
`;

  // Step 1: Research
  const research = await complete<z.infer<typeof ResearchSchema>>(
    [
      { role: 'system', content: personaPrompt },
      {
        role: 'user',
        content: `${financialSummary}\n${purchaseSummary}\n\nAs ${persona.name}, research this purchase and respond with JSON containing EXACTLY these fields:
- marketContext: a string describing the current market for this type of item
- priceAnalysis: a string analyzing whether the price is fair
- alternatives: an array of strings listing alternative products or approaches
- keyConsiderations: an array of strings with important factors to consider`,
      },
    ],
    ResearchSchema
  );

  // Step 2: Reasoning
  const reasoning = await complete<z.infer<typeof ReasoningSchema>>(
    [
      { role: 'system', content: personaPrompt },
      {
        role: 'user',
        content: `${financialSummary}\n${purchaseSummary}\n\nResearch findings:\n${JSON.stringify(research, null, 2)}\n\nAs ${persona.name}, analyze this purchase and respond with JSON containing EXACTLY these fields:
- prosFromMyPerspective: an array of strings listing reasons to approve
- consFromMyPerspective: an array of strings listing reasons to reject
- alignmentWithValues: a string explaining how this aligns with your values
- initialLeaning: either "approve", "reject", or "unsure"
- confidenceLevel: a number from 0 to 100`,
      },
    ],
    ReasoningSchema
  );

  // Step 3: Self-Critique
  const critique = await complete<z.infer<typeof CritiqueSchema>>(
    [
      { role: 'system', content: personaPrompt },
      {
        role: 'user',
        content: `${financialSummary}\n${purchaseSummary}\n\nYour initial reasoning:\n${JSON.stringify(reasoning, null, 2)}\n\nAs ${persona.name}, critique your own reasoning and respond with JSON containing EXACTLY these fields:
- blindSpotsIdentified: an array of strings listing potential blind spots in your reasoning
- counterArguments: an array of strings with counter-arguments to consider
- revisedPosition: either "approve" or "reject" (your final decision)
- finalConfidence: a number from 0 to 100`,
      },
    ],
    CritiqueSchema
  );

  // Step 4: Final Vote
  const vote = await complete<z.infer<typeof VoteSchema>>(
    [
      { role: 'system', content: personaPrompt },
      {
        role: 'user',
        content: `${financialSummary}\n${purchaseSummary}\n\nYour research: ${JSON.stringify(research, null, 2)}\nYour reasoning: ${JSON.stringify(reasoning, null, 2)}\nYour critique: ${JSON.stringify(critique, null, 2)}\n\nAs ${persona.name}, cast your final vote and respond with JSON containing EXACTLY these fields:
- vote: either "approve" or "reject"
- reasoning: a 2-3 sentence justification explaining WHY (reference specific numbers like "At ${budgetPercentage}% of discretionary budget...")
- confidence: a number from 0 to 100
- keyFactors: an array of 2-3 strings with the main factors driving your decision
- catchphrase: one of your signature catchphrases that fits this decision`,
      },
    ],
    VoteSchema
  );

  return {
    personaSlug: persona.id,
    personaName: persona.name,
    research,
    reasoning,
    critique,
    vote,
  };
}

export async function POST(request: NextRequest) {
  let purchaseId: string | undefined;

  try {
    const body = await request.json();
    purchaseId = body.purchaseId;

    if (!purchaseId) {
      return NextResponse.json({ error: 'Purchase ID is required' }, { status: 400 });
    }

    // Update status to deliberating
    await supabase
      .from('purchase_requests')
      .update({ status: 'deliberating' })
      .eq('id', purchaseId);

    // Fetch the purchase request
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Get financial context
    const financialContext = await getFinancialContext(purchase.user_id);

    // Generate financial analysis
    const financialAnalysis = generateFinancialAnalysis(purchase.price, financialContext);

    // Get AI-powered financial insights
    let financialInsights: FinancialInsights;
    try {
      financialInsights = await getFinancialInsights(
        purchase.item,
        purchase.price,
        purchase.category,
        purchase.urgency,
        financialContext,
        financialAnalysis
      );
    } catch (err) {
      console.error('Financial insights failed, using defaults:', err);
      // Fallback if LLM call fails
      financialInsights = {
        budgetAssessment: financialAnalysis.summary,
        affordabilityVerdict: financialAnalysis.affordability.recommendation === 'easily_affordable' ? 'easily_affordable' :
          financialAnalysis.affordability.recommendation === 'affordable' ? 'affordable' :
          financialAnalysis.affordability.recommendation === 'stretch' ? 'stretch' :
          financialAnalysis.affordability.recommendation === 'not_recommended' ? 'risky' : 'unaffordable',
        keyFinancialConcerns: financialAnalysis.health.recommendations,
        spendingPatternInsights: [],
        financialRecommendation: financialAnalysis.affordability.recommendationReason,
        riskFactors: financialAnalysis.affordability.impactOnSavingsGoals,
        alternativeSuggestions: [],
      };
    }

    // Get all personas
    const personas = getBuiltInPersonas();

    // Run all board members in parallel (batched to avoid rate limits)
    const startTime = Date.now();
    const batchSize = 3;
    const results: BoardMemberResult[] = [];

    for (let i = 0; i < personas.length; i += batchSize) {
      const batch = personas.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((persona) =>
          runBoardMember(
            persona,
            purchase.item,
            purchase.price,
            purchase.category,
            purchase.description,
            purchase.urgency,
            purchase.context,
            financialContext,
            financialAnalysis,
            financialInsights
          )
        )
      );
      results.push(...batchResults);
    }

    // Tally votes
    const approveCount = results.filter((r) => r.vote.vote === 'approve').length;
    const rejectCount = results.filter((r) => r.vote.vote === 'reject').length;
    const finalDecision = approveCount > rejectCount ? 'approve' : 'reject';
    const isUnanimous = approveCount === personas.length || rejectCount === personas.length;

    // Enhanced financial context for storage
    const enrichedFinancialContext = {
      ...financialContext,
      analysis: financialAnalysis,
      insights: financialInsights,
    };

    // Create deliberation record
    const { data: deliberation, error: delibError } = await supabase
      .from('deliberations')
      .insert({
        user_id: purchase.user_id,
        purchase_id: purchaseId,
        final_decision: finalDecision,
        approve_count: approveCount,
        reject_count: rejectCount,
        is_unanimous: isUnanimous,
        summary: `The board voted ${approveCount}-${rejectCount} to ${finalDecision} this purchase. Financial assessment: ${financialInsights.affordabilityVerdict.replace('_', ' ')}.`,
        total_processing_time_ms: Date.now() - startTime,
        financial_context: enrichedFinancialContext,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (delibError) {
      console.error('Error creating deliberation:', delibError);
      return NextResponse.json({ error: 'Failed to save deliberation' }, { status: 500 });
    }

    // Save individual member results
    for (const result of results) {
      await supabase.from('member_results').insert({
        deliberation_id: deliberation.id,
        persona_slug: result.personaSlug,
        persona_name: result.personaName,
        research_output: result.research,
        reasoning_output: result.reasoning,
        critique_output: result.critique,
        final_vote: result.vote,
      });
    }

    // Update purchase status
    await supabase
      .from('purchase_requests')
      .update({ status: finalDecision === 'approve' ? 'approved' : 'rejected' })
      .eq('id', purchaseId);

    return NextResponse.json({
      success: true,
      deliberationId: deliberation.id,
      decision: finalDecision,
      approveCount,
      rejectCount,
      isUnanimous,
      financialAssessment: financialInsights.affordabilityVerdict,
    });
  } catch (error) {
    console.error('Deliberation error:', error);

    // Update purchase status to failed
    if (purchaseId) {
      await supabase
        .from('purchase_requests')
        .update({ status: 'failed' })
        .eq('id', purchaseId);
    }

    return NextResponse.json({ error: 'Deliberation failed' }, { status: 500 });
  }
}
