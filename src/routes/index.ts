import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as webhookController from '../controllers/webhookController';
import * as adminController from '../controllers/adminController';
import * as listingController from '../controllers/listingController';
import { authAdmin } from '../middleware/authAdmin';

const router = Router();

router.get('/health', (_, res) => {
  res.json({
    ok: true,
    service: 'gestim-integration',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/webhooks/gestim/test', webhookLimiter, webhookController.handleTestWebhook);
router.get('/webhooks/gestim/test/debug/latest', webhookController.getLatestDebug);

// Produzione: stesso comportamento di /test + import immediato nel DB
router.get('/webhooks/gestim', webhookLimiter, webhookController.handleProductionWebhook);
router.post('/webhooks/gestim', webhookLimiter, webhookController.handleProductionWebhook);

// Admin endpoints (protetti da token) per orchestrare l'import Gestim
router.post('/admin/gestim/import/latest', authAdmin, adminController.triggerImportLatest);
router.post('/admin/gestim/import/by-callback/:callbackId', authAdmin, adminController.triggerImportByCallback);
router.get('/admin/gestim/import-runs/latest', authAdmin, adminController.getLatestImportRun);

// Endpoint di ricerca listing per automazione email
router.get('/api/gestim/listings/:externalListingId', listingController.getListingByExternalId);

export default router;
