import 'dotenv/config';
import express from 'express';
import { loadConfig, getConfig } from './config';
import routes from './routes';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { scheduleImportJob } from './jobs/cronImportJob';

async function main(): Promise<void> {
  loadConfig();
  const config = getConfig();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(requestLogger);
  app.use(routes);
  app.use(errorHandler);

  const port = config.PORT;
  const server = app.listen(port, () => {
    logger.info({ port }, 'Server started');
    if (config.CRON_IMPORT_ENABLED) {
      scheduleImportJob();
    } else {
      logger.info('Cron import disabled; webhook mode only');
    }
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});
