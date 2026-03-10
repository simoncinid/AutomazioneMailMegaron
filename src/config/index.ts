import { z } from 'zod';
import path from 'path';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // In modalità solo-webhook il DB è facoltativo: questi campi possono mancare.
  DATABASE_HOST: z.string().optional().default(''),
  DATABASE_PORT: z.string().optional().default('5432').transform(Number),
  DATABASE_NAME: z.string().optional().default(''),
  DATABASE_USER: z.string().optional().default(''),
  DATABASE_PASSWORD: z.string().optional().default(''),
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  CA_FILE: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  CRON_IMPORT_SCHEDULE: z.string().default('0 3 * * *'),
  // Token admin opzionale: gli endpoint admin sono staccati in questa fase.
  MANUAL_IMPORT_TOKEN: z.string().optional().default(''),
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
