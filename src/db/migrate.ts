import { logger } from '../utils/logger';

async function run(): Promise<void> {
  // Modalità solo-webhook: le migrazioni sono disattivate.
  // Questo script viene comunque eseguito da Render (build command),
  // quindi deve terminare con successo senza toccare il DB.
  logger.info('Migrations skipped (DB disabilitato - solo webhook Gestim attivo).');
}

run().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
