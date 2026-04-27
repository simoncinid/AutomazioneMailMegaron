import { Request, Response } from 'express';
import * as callbackRepository from '../repositories/callbackRepository';
import * as importRunRepository from '../repositories/importRunRepository';
import { runImport } from '../services/importOrchestrationService';
import { logger } from '../utils/logger';

export async function triggerImportLatest(req: Request, res: Response): Promise<void> {
  const callback = await callbackRepository.getLatestWithZipUrl();
  if (!callback?.zip_url) {
    res.status(404).json({
      ok: false,
      error: 'No callback with ZIP URL found. Gestim must call the webhook first.',
    });
    return;
  }

  logger.info(`[MANUAL] Import richiesto sul callback #${callback.id}`);

  const result = await runImport({
    zipUrl: callback.zip_url,
    callbackId: callback.id,
    importType: 'manual',
  });

  res.status(200).json({
    ok: result.success,
    import: {
      importRunId: result.importRunId,
      success: result.success,
      agencyCode: result.agencyCode,
      siteCode: result.siteCode,
      totalListingsFound: result.totalListingsFound,
      totalListingsImported: result.totalListingsImported,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
      errorMessage: result.errorMessage ?? undefined,
    },
  });
}

export async function triggerImportByCallback(req: Request, res: Response): Promise<void> {
  const callbackId = parseInt(req.params.callbackId, 10);
  if (Number.isNaN(callbackId)) {
    res.status(400).json({ ok: false, error: 'Invalid callback ID' });
    return;
  }

  const callback = await callbackRepository.getById(callbackId);
  if (!callback) {
    res.status(404).json({ ok: false, error: 'Callback not found' });
    return;
  }

  const zipUrl = callback.zip_url;
  if (!zipUrl) {
    res.status(400).json({
      ok: false,
      error: 'Callback has no ZIP URL. Cannot import.',
    });
    return;
  }

  logger.info(`[MANUAL] Import richiesto sul callback #${callbackId}`);

  const result = await runImport({
    zipUrl,
    callbackId,
    importType: 'manual',
  });

  res.status(200).json({
    ok: result.success,
    import: {
      importRunId: result.importRunId,
      success: result.success,
      agencyCode: result.agencyCode,
      siteCode: result.siteCode,
      totalListingsFound: result.totalListingsFound,
      totalListingsImported: result.totalListingsImported,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
      errorMessage: result.errorMessage ?? undefined,
    },
  });
}

export async function getLatestImportRun(req: Request, res: Response): Promise<void> {
  const run = await importRunRepository.getLatestImportRun();
  if (!run) {
    res.status(404).json({
      ok: false,
      error: 'No import runs yet',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    importRun: {
      id: run.id,
      callbackId: run.callback_id,
      zipUrl: run.zip_url,
      importType: run.import_type,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      agencyCode: run.agency_code,
      siteCode: run.site_code,
      filesFoundJson: run.files_found_json,
      totalListingsFound: run.total_listings_found,
      totalListingsImported: run.total_listings_imported,
      errorMessage: run.error_message,
      createdAt: run.created_at,
    },
  });
}
