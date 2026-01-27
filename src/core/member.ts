import type { Persona } from '../personas/types.js';
import type { LLMProvider } from '../llm/provider.js';
import { ResearchAgent } from '../agents/research-agent.js';
import { ReasoningAgent } from '../agents/reasoning-agent.js';
import { CritiqueAgent } from '../agents/critique-agent.js';
import type { AgentConfig } from '../agents/base-agent.js';

export class BoardMember {
  public readonly id: string;
  public readonly persona: Persona;
  public readonly researchAgent: ResearchAgent;
  public readonly reasoningAgent: ReasoningAgent;
  public readonly critiqueAgent: CritiqueAgent;

  constructor(persona: Persona, llmProvider: LLMProvider) {
    this.id = persona.id;
    this.persona = persona;

    const agentConfig: AgentConfig = {
      persona,
      llmProvider,
      temperature: 0.7,
      maxTokens: 1024,
    };

    this.researchAgent = new ResearchAgent(agentConfig);
    this.reasoningAgent = new ReasoningAgent(agentConfig);
    this.critiqueAgent = new CritiqueAgent(agentConfig);
  }
}
