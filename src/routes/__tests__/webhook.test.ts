import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { loadConfig } from '../../config';
import routes from '../index';

vi.mock('../../repositories/callbackRepository', () => ({
  createCallback: vi.fn().mockResolvedValue({
    id: 1,
    received_at: new Date(),
    method: 'GET',
    headers_json: {},
    query_json: {},
    raw_url: '/webhooks/gestim/test?url=https://example.com/file.zip',
    zip_url: 'https://example.com/file.zip',
    status: 'received',
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  }),
  getLatest: vi.fn().mockResolvedValue(null),
}));

describe('Webhook endpoint', () => {
  let app: express.Express;

  beforeAll(() => {
    loadConfig();
    app = express();
    app.use(express.json());
    app.use(routes);
  });

  it('accepts GET with query params and returns stored callback id', async () => {
    const res = await request(app)
      .get('/webhooks/gestim/test')
      .query({ url: 'https://example.com/export.zip' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.received).toBe(true);
    expect(res.body.detected_zip_url).toBe('https://example.com/export.zip');
    expect(res.body.stored_callback_id).toBe(1);
    expect(res.body.timestamp).toBeDefined();
  });
});
