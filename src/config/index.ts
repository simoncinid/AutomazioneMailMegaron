import { z } from 'zod';
import path from 'path';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.string().default('5432').transform(Number),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  CA_FILE: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  CRON_IMPORT_SCHEDULE: z.string().default('0 3 * * *'),
  MANUAL_IMPORT_TOKEN: z.string().min(1),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) return config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Config validation failed:\n${messages}`);
  }

  config = result.data;
  return config;
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}
