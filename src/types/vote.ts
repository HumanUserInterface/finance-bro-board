export type VoteDecision = 'approve' | 'reject';

export interface Vote {
  memberId: string;
  memberName: string;
  decision: VoteDecision;
  confidence: number;
  reasoning: string;
  catchphrase?: string;
}

export interface VotingResult {
  purchaseId: string;
  votes: Vote[];
  finalDecision: VoteDecision;
  approveCount: number;
  rejectCount: number;
  unanimousDecision: boolean;
  summary: string;
}
