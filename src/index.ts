import 'dotenv/config';
import express from 'express';
import { loadConfig, getConfig } from './config';
import routes from './routes';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // Carichiamo solo la config base (porta, env); il DB è disattivato in questa fase.
  loadConfig();

  const app = express();
  // Necessario dietro proxy (Render, Cloudflare): rate-limit usa X-Forwarded-For
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(requestLogger);
  app.use(routes);
  app.use(errorHandler);

  const port = getConfig().PORT;
  const server = app.listen(port, () => {
    logger.info({ port }, 'Server started (DB disabilitato, solo webhook Gestim test attivo)');
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
