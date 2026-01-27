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
  createdAt?: Date;
}

export interface PersonaRegistry {
  builtIn: Persona[];
  custom: Persona[];
  active: string[];
}
