import 'dotenv/config';
import express from 'express';
import { loadConfig, getConfig } from './config';
import { getPool, closePool } from './db/client';
import routes from './routes';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { scheduleImportJob, stopImportJob } from './jobs/cronImportJob';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  loadConfig();

  const pool = getPool();
  try {
    await pool.query('SELECT 1');
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to database');
    process.exit(1);
  }

  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(requestLogger);
  app.use(routes);
  app.use(errorHandler);

  const port = getConfig().PORT;
  const server = app.listen(port, () => {
    logger.info({ port }, 'Server started');
  });

  // [STACCATO] Cron import giornaliero - riattivare quando si ripristina la funzionalità
  // scheduleImportJob();

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    // stopImportJob();
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});
