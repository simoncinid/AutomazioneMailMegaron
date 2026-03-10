import AdmZip from 'adm-zip';
import { readFile } from 'fs/promises';
import { unlink } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { parseGestimFilename } from '../utils/parseGestimFilename';
import { logger } from '../utils/logger';
import type { ParsedGestimFilename } from '../types';

export interface ExtractedFile {
  filename: string;
  content: Buffer;
  parsed: ParsedGestimFilename | null;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  tempDir: string;
}

export async function extractZip(zipPath: string): Promise<ExtractionResult> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const tempDir = path.join(tmpdir(), `gestim-extract-${randomBytes(8).toString('hex')}`);
  const files: ExtractedFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const filename = path.basename(entry.entryName);
    if (!filename.toLowerCase().endsWith('.xml')) {
      logger.debug({ filename }, 'Skipping non-XML file in ZIP');
      continue;
    }
    const content = entry.getData();
    const parsed = parseGestimFilename(filename);
    files.push({ filename, content, parsed });
  }

  return { files, tempDir };
}

export async function cleanTempFiles(zipPath: string): Promise<void> {
  try {
    await unlink(zipPath);
    logger.debug({ zipPath }, 'Temp ZIP deleted');
  } catch (err) {
    logger.warn({ err, zipPath }, 'Failed to delete temp ZIP');
  }
}
