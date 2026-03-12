import { Request, Response } from 'express';
import { detectZipUrl } from '../utils/detectZipUrl';
import { logger } from '../utils/logger';
import * as callbackRepository from '../repositories/callbackRepository';

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
    zipUrl: zipUrl ?? null,
  });

  logger.info(
    {
      callbackId: callback.id,
      method: req.method,
      rawUrl,
      query: queryJson,
      headers,
      detected_zip_url: zipUrl,
      hasZipUrl: !!zipUrl,
    },
    '[GESTIM TEST] Webhook GET ricevuto e salvato nel DB'
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
