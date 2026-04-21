import { z } from 'zod';

/** Allinea variabili Render/hosting (DB_*, TLS_CERT) con i nomi usati dal codice. */
function mergeDatabaseEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  // Se DB_* è valorizzato, ha sempre priorità su DATABASE_* (Render spesso imposta DATABASE_HOST=localhost nei template).
  if (out.DB_HOST) out.DATABASE_HOST = out.DB_HOST.trim();
  if (out.DB_PORT) out.DATABASE_PORT = out.DB_PORT.trim();
  if (out.DB_NAME) out.DATABASE_NAME = out.DB_NAME.trim();
  if (out.DB_USER) out.DATABASE_USER = out.DB_USER.trim();
  if (out.DB_PASSWORD) out.DATABASE_PASSWORD = out.DB_PASSWORD;
  if (!out.DATABASE_NAME && out.PGDATABASE) out.DATABASE_NAME = out.PGDATABASE;
  if (out.TLS_CERT) out.CA_FILE = out.TLS_CERT;
  if (out.DB_TLS_SERVERNAME) out.TLS_SERVERNAME = out.DB_TLS_SERVERNAME;
  if (out.DATABASE_SSL === undefined && out.DB_SSL !== undefined) {
    out.DATABASE_SSL = out.DB_SSL;
  }
  if (out.DATABASE_SSL === undefined && (out.TLS_CERT || out.CA_FILE)) {
    out.DATABASE_SSL = 'true';
  }
  return out;
}

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
  /** SNI / verifica cert: hostname atteso (es. *.rdb.fr-par.scw.cloud) se DB_HOST è un IP. */
  TLS_SERVERNAME: z.string().optional().default(''),
  APP_BASE_URL: z.string().url().optional(),
  CRON_IMPORT_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  CRON_IMPORT_SCHEDULE: z.string().default('0 3 * * *'),
  // Token admin opzionale: gli endpoint admin sono staccati in questa fase.
  MANUAL_IMPORT_TOKEN: z.string().optional().default(''),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) return config;

  const result = envSchema.safeParse(mergeDatabaseEnv(process.env));
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
