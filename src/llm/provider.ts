import type { z } from 'zod';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseSchema?: z.ZodSchema;
}

export interface LLMCompletionResult<T = string> {
  content: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  latencyMs: number;
}

export interface LLMProvider {
  complete<T = string>(options: LLMCompletionOptions): Promise<LLMCompletionResult<T>>;
}
