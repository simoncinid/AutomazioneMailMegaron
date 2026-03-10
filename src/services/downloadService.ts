import axios from 'axios';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';

const TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 5;

export async function downloadZip(url: string): Promise<string> {
  logger.info({ url: url.substring(0, 80) }, 'Downloading ZIP');

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    validateStatus: (status) => status >= 200 && status < 400,
    headers: {
      'User-Agent': 'GestimIntegration/1.0',
      Accept: 'application/zip, application/octet-stream, */*',
    },
  });

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  if (
    !contentType.includes('zip') &&
    !contentType.includes('octet-stream') &&
    !contentType.includes('application/x-zip')
  ) {
    logger.warn({ contentType }, 'Unexpected content type for ZIP');
  }

  const tmpPath = path.join(tmpdir(), `gestim-${randomBytes(8).toString('hex')}.zip`);
  await writeFile(tmpPath, response.data);
  logger.info({ tmpPath }, 'ZIP saved to temp file');
  return tmpPath;
}
