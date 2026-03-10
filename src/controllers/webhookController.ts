import { Request, Response } from 'express';
import { detectZipUrl } from '../utils/detectZipUrl';
import * as callbackRepository from '../repositories/callbackRepository';
import { logger } from '../utils/logger';

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const exclude = ['authorization', 'cookie', 'x-api-key'];
  for (const [k, v] of Object.entries(headers)) {
    if (exclude.includes(k.toLowerCase())) continue;
    sanitized[k] = v;
  }
  return sanitized;
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
    zipUrl,
    status: 'received',
    notes: zipUrl ? null : 'No ZIP URL detected in query',
  });

  // Log dettagliato di tutto ciò che arriva dalla GET (per test Gestim)
  logger.info(
    {
      callbackId: callback.id,
      method: req.method,
      rawUrl,
      query: queryJson,
      headers: headers,
      detected_zip_url: zipUrl,
      hasZipUrl: !!zipUrl,
    },
    '[GESTIM TEST] Webhook GET ricevuto'
  );

  res.status(200).json({
    ok: true,
    received: true,
    detected_zip_url: zipUrl ?? null,
    stored_callback_id: callback.id,
    timestamp: new Date().toISOString(),
  });
}

export async function getLatestDebug(req: Request, res: Response): Promise<void> {
  const latest = await callbackRepository.getLatest();
  if (!latest) {
    res.status(404).json({
      ok: false,
      error: 'No callbacks received yet',
    });
    return;
  }

  const zipUrl = detectZipUrl(latest.query_json as Record<string, unknown>);

  res.status(200).json({
    ok: true,
    callback: {
      id: latest.id,
      received_at: latest.received_at,
      method: latest.method,
      query_json: latest.query_json,
      raw_url: latest.raw_url,
      detected_zip_url: zipUrl ?? latest.zip_url,
      status: latest.status,
      notes: latest.notes,
      created_at: latest.created_at,
    },
  });
}
