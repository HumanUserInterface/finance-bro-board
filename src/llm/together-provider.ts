import Together from 'together-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './provider.js';

export interface TogetherConfig {
  apiKey: string;
  model: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class TogetherProvider implements LLMProvider {
  private client: Together;
  private config: TogetherConfig;

  constructor(config: TogetherConfig) {
    this.config = config;
    this.client = new Together({
      apiKey: config.apiKey,
    });
  }

  async complete<T = string>(options: LLMCompletionOptions): Promise<LLMCompletionResult<T>> {
    const startTime = Date.now();

    let messages = [...options.messages];

    // Add schema instruction if responseSchema is provided
    if (options.responseSchema) {
      const jsonSchema = zodToJsonSchema(options.responseSchema, 'response');
      const schemaInstruction = `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema.definitions?.response || jsonSchema, null, 2)}\n\nRespond ONLY with the JSON object, no other text.`;

      messages = messages.map((msg, idx) => {
        if (msg.role === 'system') {
          return { ...msg, content: msg.content + schemaInstruction };
        }
        return msg;
      });

      // If no system message, add one
      if (!messages.some((m) => m.role === 'system')) {
        messages.unshift({
          role: 'system',
          content: `You are a helpful assistant.${schemaInstruction}`,
        });
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as Together.Chat.CompletionCreateParams['messages'],
      temperature: options.temperature ?? this.config.defaultTemperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens ?? 2048,
    });

    const content = response.choices[0]?.message?.content ?? '';
    let parsedContent: T;

    if (options.responseSchema) {
      try {
        // Extract JSON from the response (handle potential markdown code blocks)
        let jsonContent = content.trim();
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.slice(7);
        }
        if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.slice(3);
        }
        if (jsonContent.endsWith('```')) {
          jsonContent = jsonContent.slice(0, -3);
        }
        jsonContent = jsonContent.trim();

        const parsed = JSON.parse(jsonContent);
        parsedContent = options.responseSchema.parse(parsed) as T;
      } catch (error) {
        throw new Error(`Failed to parse structured response: ${error}\nRaw response: ${content}`);
      }
    } else {
      parsedContent = content as T;
    }

    return {
      content: parsedContent,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: this.config.model,
      latencyMs: Date.now() - startTime,
    };
  }
}
