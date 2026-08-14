import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional(),
  DATABASE_DIRECT_URL: z.string().optional(),
  SUPABASE_PROJECT_ID: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().default(10),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  OPENROUTER_CHAT_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct'),
  OPENROUTER_DESCRIPTION_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct'),
  OPENROUTER_PRICING_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct'),
  OPENROUTER_SENTIMENT_MODEL: z.string().default('meta-llama/llama-3.1-8b-instruct'),
});

export const env = envSchema.parse(process.env);
