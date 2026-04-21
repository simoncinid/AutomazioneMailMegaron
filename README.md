# Gestim XML Integration

Backend service per l'integrazione con Gestim. Riceve webhook con URL ZIP, scarica ed estrae XML, e mantiene un database locale ricercabile dei listing immobiliari. Il comportamento predefinito e' solo webhook: l'import parte quando Gestim invia il callback.

## Requisiti

- Node.js >= 18
- PostgreSQL

## Setup

```bash
npm install
cp .env.example .env
# Modifica .env con le tue variabili
npm run migrate:dev   # oppure npm run migrate dopo il build
npm run dev
```

## Variabili d'ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| PORT | Porta HTTP | 3000 |
| NODE_ENV | development / production / test | development |
| DATABASE_HOST | Host PostgreSQL | - |
| DATABASE_PORT | Porta PostgreSQL | 5432 |
| DATABASE_NAME | Nome database | - |
| DATABASE_USER | Utente DB | - |
| DATABASE_PASSWORD | Password DB | - |
| DATABASE_SSL | Abilita SSL (true/false) | - |
| CA_FILE | Certificato CA per SSL DB (contenuto PEM) | - |
| APP_BASE_URL | URL base dell'app (opzionale) | - |
| CRON_IMPORT_ENABLED | Abilita il cron di re-import automatico | false |
| CRON_IMPORT_SCHEDULE | Espressione cron usata solo se il cron e' abilitato | 0 3 * * * |
| MANUAL_IMPORT_TOKEN | Token per endpoint admin | - |

## Deploy su Render

1. Crea un Web Service su Render
2. Connetti il repository
3. Build command: `npm install && npm run build`
4. Start command: `npm run migrate && npm start`
5. Imposta le variabili d'ambiente (incluso CA_FILE per SSL DigitalOcean)

## API

### Health check
```bash
curl http://localhost:3000/health
```

### Webhook Gestim (endpoint pubblico per test)
```bash
# Con URL ZIP nel parametro url
curl "http://localhost:3000/webhooks/gestim/test?url=https://example.com/export.zip"

# Con parametro callback (Gestim potrebbe usare nomi diversi)
curl "http://localhost:3000/webhooks/gestim/test?callback=https://example.com/export.zip"
```

### Debug - Ultimo callback ricevuto
```bash
curl http://localhost:3000/webhooks/gestim/test/debug/latest
```

### Import manuale (richiede token)
```bash
# Importa l'ultimo ZIP URL ricevuto
curl -X POST http://localhost:3000/admin/gestim/import/latest \
  -H "x-manual-import-token: YOUR_TOKEN"

# Importa da callback specifico
curl -X POST http://localhost:3000/admin/gestim/import/by-callback/1 \
  -H "x-manual-import-token: YOUR_TOKEN"

# Ultimo import run
curl http://localhost:3000/admin/gestim/import-runs/latest \
  -H "x-manual-import-token: YOUR_TOKEN"
```

### Ricerca listing
```bash
curl http://localhost:3000/api/gestim/listings/123456
```

## Struttura progetto

```
src/
  config/       - Caricamento e validazione config
  db/            - Client PostgreSQL, migrazioni
  routes/        - Definizione route Express
  controllers/   - Handler HTTP
  services/      - Download ZIP, parsing XML, orchestrazione import
  repositories/  - Accesso DB
  jobs/          - Cron job opzionale per re-import automatico
  utils/         - Logger, detectZipUrl, parseGestimFilename, xmlHelpers
  middleware/    - Logging, error handling, auth
  types/         - Tipi TypeScript
```

## Adattamento allo schema XML reale

Dopo aver ricevuto i primi file di test da Gestim, potrai dover modificare:

1. **src/services/xmlParserService.ts**
   - `LISTING_TAG_MAPPINGS`: mapping tag XML → campi normalizzati
   - `findListingRoot()`: struttura root dell'XML annunci
   - Parsers per lookup, agenzie, agenti

2. **src/utils/detectZipUrl.ts**
   - `PREFERRED_KEYS`: aggiungi il nome del parametro che Gestim usa

3. **src/services/lookupResolutionService.ts**
   - `ZONE_LOOKUP_GROUPS`, `PROPERTY_TYPE_LOOKUP_GROUPS`, ecc.: nomi dei gruppi lookup nell'XML
   - ID fields nel raw_json dei listing da risolvere (zona_id, zone_id, etc.)

Cercare nel codice i commenti `TODO:` per i punti da rivedere dopo i test.

## Automazione email (futuro)

Il codice è strutturato per aggiungere facilmente un modulo di automazione email. L'endpoint `GET /api/gestim/listings/:externalListingId` restituisce la zona del listing e può essere usato da un servizio che legge email e cerca il listing per ID.
# AutomazioneMailMegaron
