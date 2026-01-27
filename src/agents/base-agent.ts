import type { z } from 'zod';
import type { Persona } from '../personas/types.js';
import type { LLMProvider, LLMMessage } from '../llm/provider.js';
import type { AgentContext } from '../types/deliberation.js';

export interface AgentConfig {
  persona: Persona;
  llmProvider: LLMProvider;
  temperature?: number;
  maxTokens?: number;
}

export abstract class BaseAgent<TOutput> {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  abstract execute(context: AgentContext): Promise<TOutput>;

  protected abstract getSchema(): z.ZodSchema<TOutput>;
  protected abstract getPrompt(context: AgentContext): string;

  protected buildSystemPrompt(): string {
    const { persona } = this.config;
    return `You are ${persona.name}, ${persona.title}.

ARCHETYPE: ${persona.archetype}

BACKSTORY: ${persona.backstory}

YOUR TRAITS:
- Risk Tolerance: ${persona.traits.riskTolerance}
- Investment Style: ${persona.traits.investmentStyle}
- Favorite Metrics: ${persona.traits.favoriteMetrics.join(', ')}
- Pet Peeves: ${persona.traits.petPeeves.join(', ')}
- Biases: ${persona.traits.biases.join(', ')}

YOUR VOICE: ${persona.voiceDescription}

YOUR DECISION FRAMEWORK: ${persona.decisionFramework}

CATCHPHRASES YOU USE: ${persona.traits.catchphrases.join(' | ')}

Stay in character at all times. Your responses should reflect your unique perspective and biases.`;
  }

  protected async callLLM(context: AgentContext): Promise<TOutput> {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.getPrompt(context) },
    ];

    const result = await this.config.llmProvider.complete<TOutput>({
      messages,
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 1024,
      responseSchema: this.getSchema(),
    });

    return result.content;
  }
}
