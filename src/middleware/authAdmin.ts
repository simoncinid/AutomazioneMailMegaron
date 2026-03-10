import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config';

export function authAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-manual-import-token'] as string | undefined;
  const expected = getConfig().MANUAL_IMPORT_TOKEN;
  if (!token || token !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }
  next();
}
