import net from 'net';
import tls from 'tls';
import { Pool, PoolConfig } from 'pg';
import type { ConnectionOptions } from 'tls';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

/**
 * node-pg: se `host` è stringa vuota, si usa PGHOST (su Render spesso "localhost") → TLS verso IP sbagliato.
 * Leggiamo DB_HOST anche fuori dalla config parsata per evitare mismatch con env inject / cache.
 */
function resolveDatabaseHost(config: { DATABASE_HOST: string }): string {
  const candidates: Array<string | undefined> = [
    process.env.DB_HOST,
    config.DATABASE_HOST,
    process.env.DATABASE_HOST,
  ];
  for (const raw of candidates) {
    const h = typeof raw === 'string' ? raw.trim() : '';
    if (h && h !== 'localhost' && h !== '127.0.0.1') return h;
  }
  for (const raw of candidates) {
    const h = typeof raw === 'string' ? raw.trim() : '';
    if (h) return h;
  }
  const pgHost = (process.env.PGHOST || '').trim();
  return pgHost;
}

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
    const host = resolveDatabaseHost(config);
    if (!host.trim()) {
      throw new Error(
        'DATABASE_HOST / DB_HOST mancante o vuoto. node-pg in quel caso usa PGHOST o localhost. Imposta DB_HOST (es. IP Scaleway o hostname rw-….rdb.fr-par.scw.cloud).'
      );
    }
    assertProductionSslHost(host, config.DATABASE_SSL);

    if (process.env.NODE_ENV === 'production') {
      logger.info(
        {
          hasEnvDbHost: Boolean(process.env.DB_HOST?.trim()),
          hasEnvDatabaseHost: Boolean(process.env.DATABASE_HOST?.trim()),
          hasPghost: Boolean(process.env.PGHOST?.trim()),
          usingHost: host.includes('.') ? 'ip-or-fqdn' : 'other',
        },
        'Postgres pool: host risolto (dettaglio host omesso)'
      );
    }

    const poolConfig: PoolConfig = {
      host,
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
      const sn = config.TLS_SERVERNAME?.trim();
      if (sn) {
        sslOpts.servername = sn;
      } else if (net.isIP(host) !== 0) {
        // Node vieta servername = IP. node-pg con host IP non imposta SNI → verifica cert esplicita su SAN iPAddress.
        sslOpts.checkServerIdentity = (_servername: string, cert: tls.PeerCertificate) =>
          tls.checkServerIdentity(host, cert);
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
