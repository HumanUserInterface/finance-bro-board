import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const ConfigSchema = z.object({
  TOGETHER_API_KEY: z.string().min(1, 'TOGETHER_API_KEY is required'),
  TOGETHER_MODEL: z.string().default('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'),
  DEFAULT_TEMPERATURE: z.coerce.number().default(0.7),
  MAX_TOKENS: z.coerce.number().default(2048),
  PARALLEL_EXECUTION: z.coerce.boolean().default(true),
  DATA_DIR: z.string().default('./data'),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Configuration error:\n${errors}\n\nMake sure you have a .env file with the required variables.`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getConfig(): Config {
  return loadConfig();
}
