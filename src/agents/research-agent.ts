import { BaseAgent, type AgentConfig } from './base-agent.js';
import { ResearchOutputSchema, type ResearchSchemaType } from '../llm/schemas.js';
import type { AgentContext, ResearchOutput } from '../types/deliberation.js';

export class ResearchAgent extends BaseAgent<ResearchSchemaType> {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected getSchema() {
    return ResearchOutputSchema;
  }

  protected getPrompt(context: AgentContext): string {
    const { purchase } = context;

    return `RESEARCH TASK: Analyze this potential purchase from your unique perspective.

PURCHASE DETAILS:
- Item: ${purchase.item}
- Price: ${purchase.currency}${purchase.price}
- Category: ${purchase.category}
- Urgency: ${purchase.urgency}
${purchase.description ? `- Description: ${purchase.description}` : ''}
${purchase.url ? `- URL: ${purchase.url}` : ''}
${purchase.context ? `- User Context: ${purchase.context}` : ''}

Based on your persona and expertise, research and analyze this purchase. Consider:
1. What are the key findings about this item/price point?
2. How does the price compare to alternatives?
3. What alternatives exist?
4. What's the current market context?

Apply your unique perspective and biases to this analysis.`;
  }

  async execute(context: AgentContext): Promise<ResearchOutput> {
    const result = await this.callLLM(context);

    return {
      memberId: this.config.persona.id,
      findings: result.findings,
      priceAnalysis: result.priceAnalysis,
      alternativesFound: result.alternativesFound,
      marketContext: result.marketContext,
    };
  }
}
