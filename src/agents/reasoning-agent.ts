import { BaseAgent, type AgentConfig } from './base-agent.js';
import { ReasoningOutputSchema, type ReasoningSchemaType } from '../llm/schemas.js';
import type { AgentContext, ReasoningOutput } from '../types/deliberation.js';

export class ReasoningAgent extends BaseAgent<ReasoningSchemaType> {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected getSchema() {
    return ReasoningOutputSchema;
  }

  protected getPrompt(context: AgentContext): string {
    const { purchase, previousOutputs } = context;
    const research = previousOutputs?.research;

    return `REASONING TASK: Form your opinion on this purchase based on your research.

PURCHASE DETAILS:
- Item: ${purchase.item}
- Price: ${purchase.currency}${purchase.price}
- Category: ${purchase.category}
- Urgency: ${purchase.urgency}
${purchase.description ? `- Description: ${purchase.description}` : ''}
${purchase.context ? `- User Context: ${purchase.context}` : ''}

YOUR RESEARCH FINDINGS:
${research ? `
- Key Findings: ${research.findings.join('; ')}
- Price Analysis: ${research.priceAnalysis}
- Alternatives Found: ${research.alternativesFound.join('; ')}
- Market Context: ${research.marketContext}
` : 'No research available.'}

Based on your persona, decision framework, and the research above:
1. What is your initial opinion? (approve or reject)
2. What are your arguments supporting this opinion?
3. What concerns do you have?
4. How do your personal biases influence this opinion?

Be authentic to your character. Your opinion should clearly reflect your unique perspective.`;
  }

  async execute(context: AgentContext): Promise<ReasoningOutput> {
    const result = await this.callLLM(context);

    return {
      memberId: this.config.persona.id,
      initialOpinion: result.initialOpinion,
      arguments: result.arguments,
      concerns: result.concerns,
      personalBias: result.personalBias,
    };
  }
}
