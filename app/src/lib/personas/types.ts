export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive' | 'yolo';

export interface PersonaTraits {
  riskTolerance: RiskTolerance;
  investmentStyle: string;
  favoriteMetrics: string[];
  petPeeves: string[];
  catchphrases: string[];
  biases: string[];
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  archetype: string;
  backstory: string;
  traits: PersonaTraits;
  voiceDescription: string;
  decisionFramework: string;
  isBuiltIn: boolean;
}

export interface PersonaVote {
  personaId: string;
  personaName: string;
  decision: 'approve' | 'reject';
  confidence: number;
  reasoning: string;
  keyPoints: string[];
}

export interface DeliberationResult {
  finalDecision: 'approve' | 'reject';
  approveCount: number;
  rejectCount: number;
  isUnanimous: boolean;
  summary: string;
  votes: PersonaVote[];
}
