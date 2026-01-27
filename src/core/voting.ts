import type { Vote, VoteDecision, VotingResult } from '../types/vote.js';
import type { DeliberationResult, ReasoningOutput, CritiqueOutput } from '../types/deliberation.js';
import type { Persona } from '../personas/types.js';

export function generateVote(
  persona: Persona,
  reasoning: ReasoningOutput,
  critique: CritiqueOutput
): Vote {
  const decision: VoteDecision = critique.revisedOpinion ?? reasoning.initialOpinion;

  const catchphrases = persona.traits.catchphrases;
  const catchphrase = catchphrases[Math.floor(Math.random() * catchphrases.length)];

  return {
    memberId: persona.id,
    memberName: persona.name,
    decision,
    confidence: critique.finalConfidence,
    reasoning: critique.finalReasoning,
    catchphrase,
  };
}

export function tallyVotes(purchaseId: string, results: DeliberationResult[]): VotingResult {
  const votes = results.map((r) => r.finalVote);
  const approveCount = votes.filter((v) => v.decision === 'approve').length;
  const rejectCount = votes.filter((v) => v.decision === 'reject').length;

  const finalDecision: VoteDecision = approveCount > rejectCount ? 'approve' : 'reject';
  const unanimousDecision = approveCount === 0 || rejectCount === 0;

  const summary = generateSummary(votes, finalDecision, unanimousDecision);

  return {
    purchaseId,
    votes,
    finalDecision,
    approveCount,
    rejectCount,
    unanimousDecision,
    summary,
  };
}

function generateSummary(
  votes: Vote[],
  decision: VoteDecision,
  unanimous: boolean
): string {
  const approvers = votes.filter((v) => v.decision === 'approve');
  const rejecters = votes.filter((v) => v.decision === 'reject');

  let summary = `The board has ${decision === 'approve' ? 'APPROVED' : 'REJECTED'} this purchase`;

  if (unanimous) {
    summary += ' unanimously';
  } else {
    summary += ` (${approvers.length}-${rejecters.length})`;
  }

  summary += '. ';

  if (decision === 'approve' && approvers.length > 0) {
    const topApprover = approvers.sort((a, b) => b.confidence - a.confidence)[0];
    summary += `${topApprover.memberName} was most confident: "${topApprover.reasoning.slice(0, 100)}..."`;
  } else if (decision === 'reject' && rejecters.length > 0) {
    const topRejecter = rejecters.sort((a, b) => b.confidence - a.confidence)[0];
    summary += `${topRejecter.memberName} was most opposed: "${topRejecter.reasoning.slice(0, 100)}..."`;
  }

  return summary;
}
