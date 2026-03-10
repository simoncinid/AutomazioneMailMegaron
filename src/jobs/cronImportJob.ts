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
    logger.info('Cron import job started');
    try {
      const callback = await callbackRepository.getLatestWithZipUrl();
      if (!callback?.zip_url) {
        logger.warn('No callback with ZIP URL available for cron import');
        return;
      }

      const result = await runImport({
        zipUrl: callback.zip_url,
        callbackId: callback.id,
        importType: 'cron',
      });

      if (result.success) {
        logger.info(
          {
            importRunId: result.importRunId,
            totalListingsImported: result.totalListingsImported,
            agencyCode: result.agencyCode,
            siteCode: result.siteCode,
          },
          'Cron import completed'
        );
      } else {
        logger.error(
          { importRunId: result.importRunId, errorMessage: result.errorMessage },
          'Cron import failed'
        );
      }
    } catch (err) {
      logger.error({ err }, 'Cron import job failed');
    }
  });

  logger.info({ schedule }, 'Cron import job scheduled');
}

export function stopImportJob(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('Cron import job stopped');
  }
}
