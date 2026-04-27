import cron from 'node-cron';
import { getConfig } from '../config';
import * as callbackRepository from '../repositories/callbackRepository';
import { runImport } from '../services/importOrchestrationService';
import { logger } from '../utils/logger';

let scheduledTask: cron.ScheduledTask | null = null;

export function scheduleImportJob(): void {
  const config = getConfig();
  const schedule = config.CRON_IMPORT_SCHEDULE;

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule(schedule, async () => {
    logger.info('Cron: avvio import periodico');
    try {
      const callback = await callbackRepository.getLatestWithZipUrl();
      if (!callback?.zip_url) {
        logger.warn('Cron: nessun callback con ZIP URL disponibile, salto');
        return;
      }

      const result = await runImport({
        zipUrl: callback.zip_url,
        callbackId: callback.id,
        importType: 'cron',
      });

      if (result.success) {
        logger.info(
          `Cron: import #${result.importRunId} OK — ${result.inserted} nuovi, ${result.updated} aggiornati, ${result.unchanged} invariati`
        );
      } else {
        logger.error(`Cron: import #${result.importRunId} FALLITO — ${result.errorMessage}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Cron: errore esecuzione job — ${msg}`);
    }
  });

  logger.info(`Cron import schedulato (${schedule})`);
}

export function stopImportJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Cron import fermato');
  }
}
