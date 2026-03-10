import { Pool, PoolConfig } from 'pg';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config = getConfig();
    const poolConfig: PoolConfig = {
      host: config.DATABASE_HOST,
      port: config.DATABASE_PORT,
      database: config.DATABASE_NAME,
      user: config.DATABASE_USER,
      password: config.DATABASE_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    if (config.DATABASE_SSL && config.CA_FILE) {
      poolConfig.ssl = {
        rejectUnauthorized: true,
        ca: config.CA_FILE,
      };
    } else if (config.DATABASE_SSL && !config.CA_FILE) {
      poolConfig.ssl = { rejectUnauthorized: true };
    }

    pool = new Pool(poolConfig);
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected pool error');
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}
