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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaObj = (jsonSchema as any).definitions?.response || jsonSchema;

    const schemaInstruction = `\n\nYou MUST respond with a valid JSON object. Here is the exact structure required:
${JSON.stringify(schemaObj, null, 2)}

CRITICAL INSTRUCTIONS:
1. Your response must be ONLY the JSON object - no explanations, no markdown
2. Every field in the schema is REQUIRED
3. Arrays must contain at least one item
4. Do not include any text before or after the JSON`;

    processedMessages = processedMessages.map((msg) => {
      if (msg.role === 'system') {
        return { ...msg, content: msg.content + schemaInstruction };
      }
      return msg;
    });

    if (!processedMessages.some((m) => m.role === 'system')) {
      processedMessages.unshift({
        role: 'system',
        content: `You are a helpful assistant that always responds in valid JSON.${schemaInstruction}`,
      });
    }
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: processedMessages as Together.Chat.CompletionCreateParams['messages'],
    temperature,
    max_tokens: 2048,
    // Force JSON mode for models that support it
    response_format: schema ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content ?? '';

  if (schema) {
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    // Try to find JSON object in the response if it's wrapped in text
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonContent);
      return schema.parse(parsed);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', jsonContent.slice(0, 500));
      throw parseError;
    }
  }

  return content as T;
}
