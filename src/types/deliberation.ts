import type { PurchaseRequest } from './purchase.js';
import type { Vote, VoteDecision, VotingResult } from './vote.js';

export interface ResearchOutput {
  memberId: string;
  findings: string[];
  priceAnalysis: string;
  alternativesFound: string[];
  marketContext: string;
}

export interface ReasoningOutput {
  memberId: string;
  initialOpinion: VoteDecision;
  arguments: string[];
  concerns: string[];
  personalBias: string;
}

export interface CritiqueOutput {
  memberId: string;
  challengedPoints: string[];
  counterArguments: string[];
  revisedOpinion?: VoteDecision;
  finalConfidence: number;
  finalReasoning: string;
}

export interface DeliberationResult {
  memberId: string;
  memberName: string;
  research: ResearchOutput;
  reasoning: ReasoningOutput;
  critique: CritiqueOutput;
  finalVote: Vote;
  processingTimeMs: number;
}

export interface BoardDeliberation {
  id: string;
  purchase: PurchaseRequest;
  memberResults: DeliberationResult[];
  votingResult: VotingResult;
  startedAt: Date;
  completedAt: Date;
  totalProcessingTimeMs: number;
}

export interface AgentContext {
  purchase: PurchaseRequest;
  previousOutputs?: {
    research?: ResearchOutput;
    reasoning?: ReasoningOutput;
  };
}
