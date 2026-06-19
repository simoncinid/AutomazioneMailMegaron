import { XMLParser } from 'fast-xml-parser';
import { ensureArray, toNullableString, toNullableNumber } from '../utils/xmlHelpers';
import { logger } from '../utils/logger';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true,
});

/**
 * TODO: Adjust these mappings after inspecting real Gestim XML.
 * The exact tag names and structure may differ from the examples below.
 */
const LISTING_TAG_MAPPINGS = {
  /** Gestim WEB: `<id>` numerico + `<Codice>` riferimento ufficio (es. 2010272) */
  externalId: ['id', 'Codice', 'annuncio_id', 'codice', 'codice_annuncio', 'listing_id'],
  title: ['titolo', 'title', 'descrizione_breve'],
  contractType: ['tipo_contratto', 'contratto', 'contract_type'],
  propertyType: ['tipo_immobile', 'tipologia', 'property_type', 'Tipologia'],
  city: ['citta', 'comune', 'Comune', 'city', 'localita'],
  province: ['provincia', 'province', 'Provincia'],
  postalCode: ['cap', 'postal_code', 'codice_postale', 'CAP'],
  address: ['indirizzo', 'address', 'via', 'Indirizzo'],
  zone: ['zona', 'area', 'zone', 'quartiere', 'zona_affari', 'frazione', 'Frazione'],
  price: ['prezzo', 'price', 'valorizzato', 'Prezzo_Richiesto'],
  bedrooms: ['camere', 'stanze', 'bedrooms', 'locali', 'Locali'],
  bathrooms: ['bagni', 'bathrooms'],
  surface: ['superficie', 'mq', 'surface_m2', 'metratura', 'Totale_mq'],
  description: ['descrizione', 'description', 'testo'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeXmlKey(key: string): string {
  const withoutNs = key.includes(':') ? key.split(':').pop() ?? key : key;
  return withoutNs.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFieldInsensitive(obj: Record<string, unknown>, keys: string[]): unknown {
  const wanted = new Set(keys.map(normalizeXmlKey));
  for (const [key, value] of Object.entries(obj)) {
    if (wanted.has(normalizeXmlKey(key))) return value;
  }
  return undefined;
}

function getNestedInsensitive(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = getFieldInsensitive(current, [segment]);
    if (current === undefined) return undefined;
  }
  return current;
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  return ensureArray(value).filter(isRecord);
}

function findItemsWithParent(
  root: Record<string, unknown>,
  parentKeys: string[],
  itemKeys: string[]
): Record<string, unknown>[] {
  const parent = getFieldInsensitive(root, parentKeys);
  if (!parent) return [];
  if (Array.isArray(parent)) return parent.filter(isRecord);
  if (!isRecord(parent)) return [];
  const direct = toObjectArray(getFieldInsensitive(parent, itemKeys));
  if (direct.length > 0) return direct;
  const fallback = toObjectArray(parent);
  return fallback;
}

/** Radice documento: `<export>` (test) oppure `<import>` (Gestim WEB V-90+). */
function listingDocumentRoot(parsed: Record<string, unknown>): Record<string, unknown> {
  const exportNode = getFieldInsensitive(parsed, ['export']);
  if (isRecord(exportNode)) {
    return exportNode;
  }
  const importNode = getFieldInsensitive(parsed, ['import']);
  if (isRecord(importNode)) {
    return importNode;
  }
  return parsed;
}

function extractField(obj: Record<string, unknown>, keys: string[]): unknown {
  const value = getFieldInsensitive(obj, keys);
  if (value !== undefined && value !== null) return value;
  for (const key of keys) {
    const val = obj[key] ?? obj['#text'];
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
}

function parseListingItem(
  item: Record<string, unknown>,
  agencyCode: string | null,
  siteCode: string | null,
  importRunId: number
): {
  external_listing_id: string;
  /** Riferimento annuncio Gestim (tag `<Codice>`, tipicamente 7–9 caratteri); non l'id numerico `<id>`. */
  id_annuncio_gestim: string | null;
  title: string | null;
  contract_type: string | null;
  property_type: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  address: string | null;
  zone: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_m2: number | null;
  description: string | null;
  raw_json: Record<string, unknown>;
} {
  const raw = { ...item };
  const externalId = String(
    extractField(item, LISTING_TAG_MAPPINGS.externalId) ?? extractField(item, ['@_id']) ?? ''
  ).trim();
  if (!externalId) {
    throw new Error('Listing missing external ID');
  }

  const idAnnuncioGestim = toNullableString(
    extractField(item, ['Codice', 'codice', 'codice_annuncio'])
  );

  return {
    external_listing_id: externalId,
    id_annuncio_gestim: idAnnuncioGestim,
    title: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.title)),
    contract_type: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.contractType)),
    property_type: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.propertyType)),
    city: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.city)),
    province: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.province)),
    postal_code: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.postalCode)),
    address: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.address)),
    zone: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.zone)),
    price: toNullableNumber(extractField(item, LISTING_TAG_MAPPINGS.price)),
    bedrooms: toNullableNumber(extractField(item, LISTING_TAG_MAPPINGS.bedrooms)),
    bathrooms: toNullableNumber(extractField(item, LISTING_TAG_MAPPINGS.bathrooms)),
    surface_m2: toNullableNumber(extractField(item, LISTING_TAG_MAPPINGS.surface)),
    description: toNullableString(extractField(item, LISTING_TAG_MAPPINGS.description)),
    raw_json: raw,
  };
}

/**
 * TODO: Adjust root/child structure based on real XML.
 * Common patterns: root.annunci.annuncio, root.annuncio, root.export.listing, etc.
 */
function findListingRoot(obj: Record<string, unknown>): unknown[] {
  const candidatePaths = [
    ['import', 'immobili', 'immobile'],
    ['immobili', 'immobile'],
    ['annunci', 'annuncio'],
    ['annunci', 'immobile'],
    ['annuncio'],
    ['immobile'],
    ['listings', 'listing'],
    ['listing'],
    ['export', 'annunci', 'annuncio'],
    ['root', 'annunci', 'annuncio'],
  ];

  for (const p of candidatePaths) {
    const arr = toObjectArray(getNestedInsensitive(obj, p));
    if (arr.length > 0) return arr;
  }

  for (const parentKey of ['annunci', 'immobili', 'listings']) {
    const parent = getFieldInsensitive(obj, [parentKey]);
    if (!parent) continue;
    if (Array.isArray(parent)) {
      const arr = parent.filter(isRecord);
      if (arr.length > 0) return arr;
      continue;
    }
    if (!isRecord(parent)) continue;

    const child = toObjectArray(getFieldInsensitive(parent, ['annuncio', 'immobile', 'listing', 'item']));
    if (child.length > 0) return child;
  }

  const topLevelRecords = Object.values(obj).filter(isRecord);
  for (const r of topLevelRecords) {
    const child = toObjectArray(getFieldInsensitive(r, ['annuncio', 'immobile', 'listing', 'item']));
    if (child.length > 0) return child;
  }

  return [];
}

export function parseListingsXml(
  content: Buffer,
  agencyCode: string | null,
  siteCode: string | null,
  importRunId: number
): Array<ReturnType<typeof parseListingItem>> {
  const xmlStr = content.toString('utf-8');
  const parsed = parser.parse(xmlStr);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid XML: empty or not object');
  }

  const root = listingDocumentRoot(parsed as Record<string, unknown>);
  const items = findListingRoot(root);
  const results: Array<ReturnType<typeof parseListingItem>> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') continue;
    try {
      results.push(
        parseListingItem(item as Record<string, unknown>, agencyCode, siteCode, importRunId)
      );
    } catch (err) {
      logger.warn({ err, index: i }, 'Skipping malformed listing item');
    }
  }
  return results;
}

/**
 * TODO: Adjust structure for lookup XML.
 * Common: root.lookup.categoria, root.categorie.categoria, etc.
 */
export function parseLookupXml(
  content: Buffer,
  agencyCode: string | null,
  siteCode: string | null,
  importRunId: number
): Array<{
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  lookup_scope: string;
  lookup_group: string;
  lookup_key: string;
  lookup_value: string;
  language: string | null;
  raw_json: Record<string, unknown> | null;
}> {
  const xmlStr = content.toString('utf-8');
  const parsed = parser.parse(xmlStr);
  if (!parsed || typeof parsed !== 'object') return [];

  const root = listingDocumentRoot(parsed as Record<string, unknown>);
  const results: Array<{
    import_run_id: number;
    agency_code: string | null;
    site_code: string | null;
    lookup_scope: string;
    lookup_group: string;
    lookup_key: string;
    lookup_value: string;
    language: string | null;
    raw_json: Record<string, unknown> | null;
  }> = [];

  for (const [groupName, groupData] of Object.entries(root)) {
    if (!groupData || typeof groupData !== 'object') continue;
    const g = groupData as Record<string, unknown>;
    let items: unknown[] = [];
    if (Array.isArray(g)) {
      items = g;
    } else {
      const child = g.item ?? g.voce ?? g.entry ?? g.categoria ?? g.zona ?? g.voce_lookup ?? g[Object.keys(g)[0] ?? ''];
      items = ensureArray(child);
    }
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const key = String(
        extractField(obj, ['id', 'codice', 'key', '@_id', '@_codice', '@_key']) ?? ''
      ).trim();
      const value = String(extractField(obj, ['valore', 'value', 'descrizione', 'label', 'desc', '#text']) ?? '').trim();
      if (!key) continue;
      results.push({
        import_run_id: importRunId,
        agency_code: agencyCode,
        site_code: siteCode,
        lookup_scope: agencyCode ? 'agency' : 'generic',
        lookup_group: groupName,
        lookup_key: key,
        lookup_value: value || key,
        language: toNullableString(extractField(obj, ['lingua', 'lang', 'language'])),
        raw_json: obj,
      });
    }
  }
  return results;
}

/**
 * TODO: Adjust structure for agencies XML.
 */
export function parseAgenciesXml(
  content: Buffer,
  agencyCode: string | null,
  siteCode: string | null,
  importRunId: number
): Array<{
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_agency_id: string | null;
  name: string | null;
  status: string | null;
  email: string | null;
  phone: string | null;
  raw_json: Record<string, unknown>;
}> {
  const xmlStr = content.toString('utf-8');
  const parsed = parser.parse(xmlStr);
  if (!parsed || typeof parsed !== 'object') return [];

  const root = listingDocumentRoot(parsed as Record<string, unknown>);
  const arr = [
    ...findItemsWithParent(root, ['agenzie', 'agencies'], ['agenzia', 'agency', 'item']),
    ...toObjectArray(getFieldInsensitive(root, ['agenzia', 'agency'])),
  ];
  const uniqueItems = arr.length > 0 ? arr : [root];

  const results: Array<{
    import_run_id: number;
    agency_code: string | null;
    site_code: string | null;
    external_agency_id: string | null;
    name: string | null;
    status: string | null;
    email: string | null;
    phone: string | null;
    raw_json: Record<string, unknown>;
  }> = [];

  for (const obj of uniqueItems) {
    results.push({
      import_run_id: importRunId,
      agency_code: agencyCode,
      site_code: siteCode,
      external_agency_id: toNullableString(extractField(obj, ['id', 'codice', '@_id'])),
      name: toNullableString(extractField(obj, ['nome', 'name', 'ragione_sociale'])),
      status: toNullableString(extractField(obj, ['stato', 'status'])),
      email: toNullableString(extractField(obj, ['email', 'mail'])),
      phone: toNullableString(extractField(obj, ['telefono', 'phone', 'tel'])),
      raw_json: obj,
    });
  }
  return results;
}

/**
 * TODO: Adjust structure for agents XML.
 */
export function parseAgentsXml(
  content: Buffer,
  agencyCode: string | null,
  siteCode: string | null,
  importRunId: number
): Array<{
  import_run_id: number;
  agency_code: string | null;
  site_code: string | null;
  external_agent_id: string | null;
  agency_external_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  raw_json: Record<string, unknown>;
}> {
  const xmlStr = content.toString('utf-8');
  const parsed = parser.parse(xmlStr);
  if (!parsed || typeof parsed !== 'object') return [];

  const root = listingDocumentRoot(parsed as Record<string, unknown>);
  const arr = [
    ...findItemsWithParent(root, ['agenti', 'agents'], ['agente', 'agent', 'item']),
    ...toObjectArray(getFieldInsensitive(root, ['agente', 'agent'])),
  ];
  const uniqueItems = arr.length > 0 ? arr : [root];

  const results: Array<{
    import_run_id: number;
    agency_code: string | null;
    site_code: string | null;
    external_agent_id: string | null;
    agency_external_id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    raw_json: Record<string, unknown>;
  }> = [];

  for (const obj of uniqueItems) {
    results.push({
      import_run_id: importRunId,
      agency_code: agencyCode,
      site_code: siteCode,
      external_agent_id: toNullableString(extractField(obj, ['id', 'codice', '@_id'])),
      agency_external_id: toNullableString(extractField(obj, ['agenzia_id', 'agency_id', 'id_agenzia'])),
      name: toNullableString(extractField(obj, ['nome', 'name'])),
      email: toNullableString(extractField(obj, ['email', 'mail'])),
      phone: toNullableString(extractField(obj, ['telefono', 'phone', 'tel'])),
      raw_json: obj,
    });
  }
  return results;
}
