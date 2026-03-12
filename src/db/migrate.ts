import { logger } from '../utils/logger';

async function run(): Promise<void> {
  logger.info('Migrations skipped (DB disabilitato - solo webhook Gestim attivo).');
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
