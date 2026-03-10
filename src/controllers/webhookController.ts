import { Request, Response } from 'express';
import { detectZipUrl } from '../utils/detectZipUrl';
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

  // Nessun DB: logghiamo solo quello che arriva da Gestim
  logger.info(
    {
      method: req.method,
      rawUrl,
      query: queryJson,
      headers,
      detected_zip_url: zipUrl,
      hasZipUrl: !!zipUrl,
    },
    '[GESTIM TEST] Webhook GET ricevuto (solo log, DB disabilitato)'
  );

  res.status(200).json({
    ok: true,
    received: true,
    detected_zip_url: zipUrl ?? null,
    stored_callback_id: null,
    timestamp: new Date().toISOString(),
  });
}

export async function getLatestDebug(req: Request, res: Response): Promise<void> {
  // Con il DB disattivato non abbiamo storico: endpoint solo informativo
  res.status(501).json({
    ok: false,
    error: 'Storico callback disabilitato: DB non connesso in modalità test.',
  });
}
