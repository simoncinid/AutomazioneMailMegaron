# Esempi cURL per Gestim Integration

## Health check
```bash
curl http://localhost:3000/health
```

## Webhook test (endpoint pubblico)
```bash
# Con parametro url
curl "http://localhost:3000/webhooks/gestim/test?url=https://example.com/export.zip"

# Con parametro callback (nome che Gestim potrebbe usare)
curl "http://localhost:3000/webhooks/gestim/test?callback=https://gestim.example.com/files/3898_270.zip"

# Con parametro download_url
curl "http://localhost:3000/webhooks/gestim/test?download_url=https://cdn.example.com/export.zip"
```

## Debug - Ultimo callback
```bash
curl http://localhost:3000/webhooks/gestim/test/debug/latest
```

## Admin - Import manuale (richiede token)
```bash
# Sostituisci YOUR_TOKEN con il valore di MANUAL_IMPORT_TOKEN
export TOKEN="your-secret-admin-token"

# Importa l'ultimo ZIP URL ricevuto
curl -X POST http://localhost:3000/admin/gestim/import/latest \
  -H "x-manual-import-token: $TOKEN"

# Importa da callback specifico (es. ID 5)
curl -X POST http://localhost:3000/admin/gestim/import/by-callback/5 \
  -H "x-manual-import-token: $TOKEN"

# Ultimo import run
curl http://localhost:3000/admin/gestim/import-runs/latest \
  -H "x-manual-import-token: $TOKEN"
```

## API - Ricerca listing
```bash
# Cerca listing per ID esterno
curl http://localhost:3000/api/gestim/listings/123456
```
