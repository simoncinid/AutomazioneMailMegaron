import { XMLParser } from 'fast-xml-parser';
import { ensureArray, getNestedValue, toNullableString, toNullableNumber } from '../utils/xmlHelpers';
import { logger } from '../utils/logger';
import type { ExtractedFile } from './extractionService';

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

/** Radice documento: `<export>` (test) oppure `<import>` (Gestim WEB V-90+). */
function listingDocumentRoot(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed && typeof parsed.export === 'object' && parsed.export !== null) {
    return parsed.export as Record<string, unknown>;
  }
  if (parsed && typeof parsed.import === 'object' && parsed.import !== null) {
    return parsed.import as Record<string, unknown>;
  }
  return parsed as Record<string, unknown>;
}

function extractField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const val = getNestedValue(obj, [key]) ?? getNestedValue(obj, ['#text']);
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
  const candidates = [
    getNestedValue(obj, ['import', 'immobili', 'immobile']),
    getNestedValue(obj, ['immobili', 'immobile']),
    getNestedValue(obj, ['annunci', 'annuncio']),
    getNestedValue(obj, ['annunci']),
    getNestedValue(obj, ['annuncio']),
    getNestedValue(obj, ['listings', 'listing']),
    getNestedValue(obj, ['listing']),
    getNestedValue(obj, ['export', 'annunci']),
    getNestedValue(obj, ['root', 'annunci']),
    Object.values(obj)[0],
  ];
  for (const c of candidates) {
    const arr = ensureArray(c);
    if (arr.length > 0) return arr;
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

  const root = (typeof parsed.export === 'object' ? parsed.export : parsed) as Record<string, unknown>;
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
        obj.id ?? obj.codice ?? obj.key ?? obj['@_id'] ?? obj['@_codice'] ?? obj['@_key'] ?? ''
      ).trim();
      const value = String(
        obj.valore ?? obj.value ?? obj.descrizione ?? obj.label ?? obj.desc ?? obj['#text'] ?? ''
      ).trim();
      if (!key) continue;
      results.push({
        import_run_id: importRunId,
        agency_code: agencyCode,
        site_code: siteCode,
        lookup_scope: agencyCode ? 'agency' : 'generic',
        lookup_group: groupName,
        lookup_key: key,
        lookup_value: value || key,
        language: toNullableString(obj.lingua ?? obj.lang ?? obj.language),
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

  const root = (typeof parsed.export === 'object' ? parsed.export : parsed) as Record<string, unknown>;
  const items = ensureArray(
    root.agenzia ?? root.agenzie ?? root.agency ?? root.agencies ?? root
  );
  const arr = Array.isArray(items) ? items : [items];
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

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    results.push({
      import_run_id: importRunId,
      agency_code: agencyCode,
      site_code: siteCode,
      external_agency_id: toNullableString(obj.id ?? obj.codice ?? (obj as Record<string, unknown>)['@_id']),
      name: toNullableString(obj.nome ?? obj.name ?? obj.ragione_sociale),
      status: toNullableString(obj.stato ?? obj.status),
      email: toNullableString(obj.email ?? obj.mail),
      phone: toNullableString(obj.telefono ?? obj.phone ?? obj.tel),
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

  const root = (typeof parsed.export === 'object' ? parsed.export : parsed) as Record<string, unknown>;
  const items = ensureArray(
    root.agente ?? root.agenti ?? root.agent ?? root.agents ?? root
  );
  const arr = Array.isArray(items) ? items : [items];
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

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    results.push({
      import_run_id: importRunId,
      agency_code: agencyCode,
      site_code: siteCode,
      external_agent_id: toNullableString(obj.id ?? obj.codice ?? (obj as Record<string, unknown>)['@_id']),
      agency_external_id: toNullableString(obj.agenzia_id ?? obj.agency_id ?? obj.id_agenzia),
      name: toNullableString(obj.nome ?? obj.name),
      email: toNullableString(obj.email ?? obj.mail),
      phone: toNullableString(obj.telefono ?? obj.phone ?? obj.tel),
      raw_json: obj,
    });
  }
  return results;
}
