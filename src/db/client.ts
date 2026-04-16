import { Pool, PoolConfig } from 'pg';
import type { ConnectionOptions } from 'tls';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

function assertProductionSslHost(host: string, ssl: boolean): void {
  if (process.env.NODE_ENV !== 'production' || !ssl) return;
  const h = host.trim().toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1') {
    throw new Error(
      'DATABASE_SSL attivo ma DB_HOST/DATABASE_HOST è vuoto o localhost. ' +
        'Su Render imposta DB_HOST all\'endpoint Scaleway (es. rw-xxxx.rdb.fr-par.scw.cloud o l\'IP del nodo), copiato dalla console Scaleway — non localhost.'
    );
  }
}

export function getPool(): Pool {
  if (!pool) {
    const config = getConfig();
    assertProductionSslHost(config.DATABASE_HOST, config.DATABASE_SSL);

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

    if (config.DATABASE_SSL) {
      const sslOpts: ConnectionOptions = {
        rejectUnauthorized: true,
      };
      if (config.CA_FILE) {
        sslOpts.ca = config.CA_FILE;
      }
      if (config.TLS_SERVERNAME) {
        sslOpts.servername = config.TLS_SERVERNAME;
      }
      poolConfig.ssl = sslOpts;
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
