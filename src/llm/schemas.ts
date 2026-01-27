import { z } from 'zod';

export const ResearchOutputSchema = z.object({
  findings: z.array(z.string()).describe('Key findings about the purchase item'),
  priceAnalysis: z.string().describe('Analysis of the price point'),
  alternativesFound: z.array(z.string()).describe('Alternative products or options'),
  marketContext: z.string().describe('Current market conditions relevant to purchase'),
});

export const ReasoningOutputSchema = z.object({
  initialOpinion: z.enum(['approve', 'reject']).describe('Initial vote decision'),
  arguments: z.array(z.string()).describe('Arguments supporting the opinion'),
  concerns: z.array(z.string()).describe('Concerns or reservations'),
  personalBias: z.string().describe('How persona traits influence this opinion'),
});

export const CritiqueOutputSchema = z.object({
  challengedPoints: z.array(z.string()).describe('Points from reasoning that were challenged'),
  counterArguments: z.array(z.string()).describe('Counter-arguments considered'),
  revisedOpinion: z.enum(['approve', 'reject']).optional().describe('Changed opinion if any'),
  finalConfidence: z.number().min(0).max(100).describe('Confidence in final decision 0-100'),
  finalReasoning: z.string().describe('A clear 2-3 sentence justification explaining WHY you are voting this way, based on your persona values and the financial analysis. Be specific about the key factor driving your decision.'),
});

export const VoteOutputSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  catchphrase: z.string().optional(),
});

export type ResearchSchemaType = z.infer<typeof ResearchOutputSchema>;
export type ReasoningSchemaType = z.infer<typeof ReasoningOutputSchema>;
export type CritiqueSchemaType = z.infer<typeof CritiqueOutputSchema>;
export type VoteSchemaType = z.infer<typeof VoteOutputSchema>;
