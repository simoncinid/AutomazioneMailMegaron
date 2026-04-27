import { Request, Response } from 'express';
import { detectZipUrl } from '../utils/detectZipUrl';
import { logger } from '../utils/logger';
import * as callbackRepository from '../repositories/callbackRepository';
import { runImport } from '../services/importOrchestrationService';

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const exclude = ['authorization', 'cookie', 'x-api-key'];
  for (const [k, v] of Object.entries(headers)) {
    if (exclude.includes(k.toLowerCase())) continue;
    sanitized[k] = v;
  }
  return sanitized;
}

/** Query string + body JSON/form (POST) per rilevare l'URL dello ZIP. */
function mergeQueryAndBody(req: Request): Record<string, unknown> {
  const bodyObj =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  return { ...(req.query as Record<string, unknown>), ...bodyObj };
}

export async function handleTestWebhook(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, unknown>;
  const zipUrl = detectZipUrl(query);
  const rawUrl = req.originalUrl || req.url || `${req.baseUrl || ''}${req.path || ''}`;

  const headers = sanitizeHeaders(req.headers as unknown as Record<string, unknown>);
  const queryJson = { ...query };

  const callback = await callbackRepository.createCallback({
    method: req.method,
    headersJson: headers,
    queryJson,
    rawUrl,
    zipUrl: zipUrl ?? null,
  });

  logger.info(`[TEST] Webhook ricevuto (callback #${callback.id}, ZIP: ${zipUrl ? 'sì' : 'no'})`);

  res.status(200).json({
    ok: true,
    received: true,
    detected_zip_url: zipUrl ?? null,
    stored_callback_id: callback.id,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Produzione: salva il callback come /test e avvia subito download ZIP + import in PostgreSQL.
 * GET o POST (body JSON o urlencoded con stessi parametri di /test).
 */
export async function handleProductionWebhook(req: Request, res: Response): Promise<void> {
  const query = mergeQueryAndBody(req);
  const zipUrl = detectZipUrl(query);
  const rawUrl = req.originalUrl || req.url || `${req.baseUrl || ''}${req.path || ''}`;
  const headers = sanitizeHeaders(req.headers as unknown as Record<string, unknown>);
  const queryJson = { ...query };

  logger.info(`[PROD] Webhook ricevuto (${req.method}, ZIP: ${zipUrl ? 'sì' : 'no'})`);

  if (!zipUrl) {
    logger.warn('[PROD] Nessun URL ZIP rilevato — niente import');
    res.status(400).json({
      ok: false,
      error:
        'ZIP URL non rilevato. Passa un link http(s) in parametri come url, callback, zip_url, ecc.',
      received_query: queryJson,
    });
    return;
  }

  const callback = await callbackRepository.createCallback({
    method: req.method,
    headersJson: headers,
    queryJson,
    rawUrl,
    zipUrl,
  });

  logger.info(`[PROD] Callback #${callback.id} salvato, avvio import`);

  const result = await runImport({
    zipUrl,
    callbackId: callback.id,
    importType: 'webhook',
  });

  const importPayload = {
    importRunId: result.importRunId,
    success: result.success,
    agencyCode: result.agencyCode,
    siteCode: result.siteCode,
    totalListingsFound: result.totalListingsFound,
    totalListingsImported: result.totalListingsImported,
    errorMessage: result.errorMessage ?? undefined,
  };

  if (result.success) {
    logger.info(
      `[PROD] Import #${result.importRunId} OK — ${result.inserted} nuovi, ${result.updated} aggiornati, ${result.unchanged} invariati`
    );
    res.status(200).json({
      ok: true,
      received: true,
      detected_zip_url: zipUrl,
      stored_callback_id: callback.id,
      import: importPayload,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.error(`[PROD] Import #${result.importRunId} FALLITO — ${result.errorMessage}`);
  res.status(502).json({
    ok: false,
    received: true,
    detected_zip_url: zipUrl,
    stored_callback_id: callback.id,
    import: importPayload,
    error: result.errorMessage ?? 'Import failed',
    timestamp: new Date().toISOString(),
  });
}

export async function getLatestDebug(req: Request, res: Response): Promise<void> {
  const latest = await callbackRepository.getLatest();

  if (!latest) {
    res.status(404).json({
      ok: false,
      error: 'Nessun callback Gestim ricevuto finora.',
    });
    return;
  }

  res.status(200).json({
    ok: true,
    callback: {
      id: latest.id,
      received_at: latest.received_at,
      method: latest.method,
      raw_url: latest.raw_url,
      zip_url: latest.zip_url,
      status: latest.status,
      notes: latest.notes,
      headers_json: latest.headers_json,
      query_json: latest.query_json,
    },
  });
}
