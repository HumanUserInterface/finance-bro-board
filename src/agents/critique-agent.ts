import { BaseAgent, type AgentConfig } from './base-agent.js';
import { CritiqueOutputSchema, type CritiqueSchemaType } from '../llm/schemas.js';
import type { AgentContext, CritiqueOutput } from '../types/deliberation.js';

export class CritiqueAgent extends BaseAgent<CritiqueSchemaType> {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected getSchema() {
    return CritiqueOutputSchema;
  }

  protected getPrompt(context: AgentContext): string {
    const { purchase, previousOutputs } = context;
    const research = previousOutputs?.research;
    const reasoning = previousOutputs?.reasoning;

    return `SELF-CRITIQUE TASK: Challenge your own reasoning and finalize your opinion.

PURCHASE DETAILS:
- Item: ${purchase.item}
- Price: ${purchase.currency}${purchase.price}
- Category: ${purchase.category}
- Urgency: ${purchase.urgency}
${purchase.description ? `- Description: ${purchase.description}` : ''}
${purchase.context ? `- User Context: ${purchase.context}` : ''}

YOUR RESEARCH:
${research ? `
- Key Findings: ${research.findings.join('; ')}
- Price Analysis: ${research.priceAnalysis}
- Alternatives: ${research.alternativesFound.join('; ')}
` : 'No research available.'}

YOUR INITIAL REASONING:
${reasoning ? `
- Initial Opinion: ${reasoning.initialOpinion}
- Arguments: ${reasoning.arguments.join('; ')}
- Concerns: ${reasoning.concerns.join('; ')}
- Personal Bias: ${reasoning.personalBias}
` : 'No reasoning available.'}

Now, play devil's advocate against yourself:
1. What points in your reasoning can be challenged?
2. What counter-arguments exist?
3. After this self-critique, do you want to revise your opinion?
4. What is your final confidence level (0-100)?
5. What is your final reasoning? Write a clear 2-3 sentence justification that:
   - Explains the PRIMARY reason for your vote (not just "good value" - be specific)
   - References specific numbers or facts from the purchase/research
   - Reflects your unique persona perspective

Be honest in your self-critique. It's okay to change your mind or lower your confidence if the counter-arguments are compelling.`;
  }

  async execute(context: AgentContext): Promise<CritiqueOutput> {
    const result = await this.callLLM(context);

    return {
      memberId: this.config.persona.id,
      challengedPoints: result.challengedPoints,
      counterArguments: result.counterArguments,
      revisedOpinion: result.revisedOpinion,
      finalConfidence: result.finalConfidence,
      finalReasoning: result.finalReasoning,
    };
  }
}
