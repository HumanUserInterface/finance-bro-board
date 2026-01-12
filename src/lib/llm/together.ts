import Together from 'together-ai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const client = new Together({
  apiKey: process.env.TOGETHER_API_KEY!,
});

const MODEL = process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function complete<T>(
  messages: LLMMessage[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: z.ZodType<T, any, any>,
  temperature = 0.7
): Promise<T> {
  let processedMessages = [...messages];

  if (schema) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonSchema = zodToJsonSchema(schema as any, 'response');
    const schemaInstruction = `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jsonSchema as any).definitions?.response || jsonSchema,
      null,
      2
    )}\n\nRespond ONLY with the JSON object, no other text.`;

    processedMessages = processedMessages.map((msg) => {
      if (msg.role === 'system') {
        return { ...msg, content: msg.content + schemaInstruction };
      }
      return msg;
    });

    if (!processedMessages.some((m) => m.role === 'system')) {
      processedMessages.unshift({
        role: 'system',
        content: `You are a helpful assistant.${schemaInstruction}`,
      });
    }
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: processedMessages as Together.Chat.CompletionCreateParams['messages'],
    temperature,
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content ?? '';

  if (schema) {
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
    return schema.parse(parsed);
  }

  return content as T;
}
