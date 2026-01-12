import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { complete } from '@/lib/llm/together';
import { getBuiltInPersonas, type Persona } from '@/lib/personas';

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
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
  keyFactors: z.array(z.string()),
  catchphrase: z.string(),
});

interface FinancialContext {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyBills: number;
  discretionaryBudget: number;
  totalSavings: number;
  savingsGoals: Array<{ name: string; target: number; current: number; progress: number }>;
  incomeBreakdown: Array<{ name: string; amount: number; frequency: string }>;
  expenseBreakdown: Array<{ name: string; amount: number; type: string }>;
}

async function getFinancialContext(userId: string): Promise<FinancialContext> {
  // Fetch all financial data in parallel
  const [incomeRes, expensesRes, billsRes, goalsRes] = await Promise.all([
    supabase.from('income_sources').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('bills').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('savings_goals').select('*').eq('user_id', userId).eq('is_active', true),
  ]);

  const incomes = incomeRes.data || [];
  const expenses = expensesRes.data || [];
  const bills = billsRes.data || [];
  const goals = goalsRes.data || [];

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

  const monthlyExpenses = expenses
    .filter((e) => e.is_recurring)
    .reduce((total, exp) => {
      return total + exp.amount * (frequencyMultipliers[exp.frequency || 'monthly'] || 0);
    }, 0);

  const monthlyBills = bills.reduce((total, bill) => {
    return total + bill.amount * (frequencyMultipliers[bill.frequency] || 0);
  }, 0);

  const discretionaryBudget = monthlyIncome - monthlyExpenses - monthlyBills;

  const totalSavings = goals.reduce((total, goal) => total + goal.current_amount, 0);

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
    savingsGoals,
    incomeBreakdown,
    expenseBreakdown,
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
  financialContext: FinancialContext
): Promise<BoardMemberResult> {
  const financialSummary = `
FINANCIAL CONTEXT:
- Monthly Income: $${financialContext.monthlyIncome.toFixed(2)}
- Monthly Expenses: $${financialContext.monthlyExpenses.toFixed(2)}
- Monthly Bills: $${financialContext.monthlyBills.toFixed(2)}
- Discretionary Budget: $${financialContext.discretionaryBudget.toFixed(2)}
- Total Savings: $${financialContext.totalSavings.toFixed(2)}
- Savings Goals: ${financialContext.savingsGoals.map((g) => `${g.name} (${g.progress.toFixed(0)}%)`).join(', ') || 'None'}
- This purchase represents ${((purchasePrice / financialContext.discretionaryBudget) * 100).toFixed(1)}% of monthly discretionary budget
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
        content: `${financialSummary}\n${purchaseSummary}\n\nAs ${persona.name}, research this purchase. Analyze the market context, price, alternatives, and key considerations.`,
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
        content: `${financialSummary}\n${purchaseSummary}\n\nResearch findings:\n${JSON.stringify(research, null, 2)}\n\nAs ${persona.name}, analyze this purchase from your unique perspective. Consider the pros, cons, and how it aligns with your values.`,
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
        content: `${financialSummary}\n${purchaseSummary}\n\nYour initial reasoning:\n${JSON.stringify(reasoning, null, 2)}\n\nAs ${persona.name}, critique your own reasoning. What blind spots might you have? What counter-arguments should you consider? Make your final decision.`,
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
        content: `${financialSummary}\n${purchaseSummary}\n\nYour research: ${JSON.stringify(research, null, 2)}\nYour reasoning: ${JSON.stringify(reasoning, null, 2)}\nYour critique: ${JSON.stringify(critique, null, 2)}\n\nAs ${persona.name}, cast your final vote. Be decisive and include one of your signature catchphrases.`,
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
  try {
    const { purchaseId } = await request.json();

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
            financialContext
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
        summary: `The board voted ${approveCount}-${rejectCount} to ${finalDecision} this purchase.`,
        total_processing_time_ms: Date.now() - startTime,
        financial_context: financialContext,
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
    });
  } catch (error) {
    console.error('Deliberation error:', error);
    return NextResponse.json({ error: 'Deliberation failed' }, { status: 500 });
  }
}
