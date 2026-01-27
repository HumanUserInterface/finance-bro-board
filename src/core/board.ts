import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { PurchaseRequest } from '../types/purchase.js';
import type { Vote } from '../types/vote.js';
import type {
  BoardDeliberation,
  DeliberationResult,
  ResearchOutput,
  ReasoningOutput,
  CritiqueOutput,
} from '../types/deliberation.js';
import { BoardMember } from './member.js';
import { generateVote, tallyVotes } from './voting.js';

export interface BoardMeetingConfig {
  members: BoardMember[];
  parallelExecution: boolean;
}

export interface BoardMeetingEvents {
  'member:start': (memberId: string, memberName: string) => void;
  'member:research:complete': (memberId: string, research: ResearchOutput) => void;
  'member:reasoning:complete': (memberId: string, reasoning: ReasoningOutput) => void;
  'member:critique:complete': (memberId: string, critique: CritiqueOutput) => void;
  'member:vote': (memberId: string, vote: Vote) => void;
  'member:error': (memberId: string, error: Error) => void;
  'deliberation:complete': (result: BoardDeliberation) => void;
}

export class BoardMeeting extends EventEmitter {
  private config: BoardMeetingConfig;

  constructor(config: BoardMeetingConfig) {
    super();
    this.config = config;
  }

  async deliberate(purchase: PurchaseRequest): Promise<BoardDeliberation> {
    const startTime = Date.now();

    const memberResults = this.config.parallelExecution
      ? await this.executeParallel(purchase)
      : await this.executeSequential(purchase);

    const votingResult = tallyVotes(purchase.id, memberResults);

    const deliberation: BoardDeliberation = {
      id: randomUUID(),
      purchase,
      memberResults,
      votingResult,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      totalProcessingTimeMs: Date.now() - startTime,
    };

    this.emit('deliberation:complete', deliberation);
    return deliberation;
  }

  private async executeParallel(purchase: PurchaseRequest): Promise<DeliberationResult[]> {
    const promises = this.config.members.map((member) =>
      this.executeMember(member, purchase).catch((error) => {
        this.emit('member:error', member.id, error);
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter((r): r is DeliberationResult => r !== null);
  }

  private async executeSequential(purchase: PurchaseRequest): Promise<DeliberationResult[]> {
    const results: DeliberationResult[] = [];

    for (const member of this.config.members) {
      try {
        const result = await this.executeMember(member, purchase);
        results.push(result);
      } catch (error) {
        this.emit('member:error', member.id, error as Error);
      }
    }

    return results;
  }

  private async executeMember(
    member: BoardMember,
    purchase: PurchaseRequest
  ): Promise<DeliberationResult> {
    const startTime = Date.now();
    this.emit('member:start', member.id, member.persona.name);

    // Step 1: Research
    const research = await member.researchAgent.execute({ purchase });
    this.emit('member:research:complete', member.id, research);

    // Step 2: Reasoning (receives research)
    const reasoning = await member.reasoningAgent.execute({
      purchase,
      previousOutputs: { research },
    });
    this.emit('member:reasoning:complete', member.id, reasoning);

    // Step 3: Self-Critique (receives research + reasoning)
    const critique = await member.critiqueAgent.execute({
      purchase,
      previousOutputs: { research, reasoning },
    });
    this.emit('member:critique:complete', member.id, critique);

    // Generate final vote
    const finalVote = generateVote(member.persona, reasoning, critique);
    this.emit('member:vote', member.id, finalVote);

    return {
      memberId: member.id,
      memberName: member.persona.name,
      research,
      reasoning,
      critique,
      finalVote,
      processingTimeMs: Date.now() - startTime,
    };
  }
}
