import { getPool } from '../db/client';
import * as callbackRepository from '../repositories/callbackRepository';
import * as importRunRepository from '../repositories/importRunRepository';
import * as listingRepository from '../repositories/listingRepository';
import * as lookupRepository from '../repositories/lookupRepository';
import * as agencyRepository from '../repositories/agencyRepository';
import * as agentRepository from '../repositories/agentRepository';
import { downloadZip } from './downloadService';
import { extractZip, cleanTempFiles } from './extractionService';
import {
  parseListingsXml,
  parseLookupXml,
  parseAgenciesXml,
  parseAgentsXml,
} from './xmlParserService';
import {
  buildLookupMap,
  resolveLookup,
  ZONE_LOOKUP_GROUPS,
  PROPERTY_TYPE_LOOKUP_GROUPS,
  CONTRACT_TYPE_LOOKUP_GROUPS,
} from './lookupResolutionService';
import { logger } from '../utils/logger';
import type { ExtractedFile } from './extractionService';
import type { LookupInsertRow } from '../repositories/lookupRepository';
import type { ListingInsertRow } from '../repositories/listingRepository';

export interface ImportInput {
  zipUrl: string;
  callbackId?: number | null;
  importType: 'manual' | 'cron';
}

export interface ImportResult {
  success: boolean;
  importRunId: number;
  agencyCode: string | null;
  siteCode: string | null;
  totalListingsFound: number;
  totalListingsImported: number;
  errorMessage?: string | null;
}

export async function runImport(input: ImportInput): Promise<ImportResult> {
  const pool = getPool();
  let zipPath: string | null = null;

  const run = await importRunRepository.createImportRun({
    callbackId: input.callbackId ?? null,
    zipUrl: input.zipUrl,
    importType: input.importType,
    filesFoundJson: {},
  });

  try {
    zipPath = await downloadZip(input.zipUrl);
    const { files } = await extractZip(zipPath);
    const filesFoundJson: Record<string, string> = {};
    for (const f of files) {
      filesFoundJson[f.filename] = f.parsed ? `${f.parsed.agencyCode ?? 'null'}_${f.parsed.siteCode}_${f.parsed.kind}` : 'unknown';
    }
    await pool.query(
      'UPDATE gestim_import_runs SET files_found_json = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(filesFoundJson), run.id]
    );

    let agencyCode: string | null = null;
    let siteCode: string | null = null;

    const lookupFiles = files.filter((f) => f.parsed?.kind === 'lookup');
    const agencyFiles = files.filter((f) => f.parsed?.kind === 'agenzie');
    const agentFiles = files.filter((f) => f.parsed?.kind === 'agenti');
    const annunciFiles = files.filter((f) => f.parsed?.kind === 'annunci');

    for (const f of files) {
      if (f.parsed?.agencyCode) agencyCode = f.parsed.agencyCode;
      if (f.parsed?.siteCode) siteCode = f.parsed.siteCode;
    }
    if (!agencyCode && annunciFiles[0]?.parsed) agencyCode = annunciFiles[0].parsed.agencyCode ?? null;
    if (!siteCode && annunciFiles[0]?.parsed) siteCode = annunciFiles[0].parsed.siteCode ?? null;

    await pool.query(
      'UPDATE gestim_import_runs SET agency_code = $1, site_code = $2, updated_at = NOW() WHERE id = $3',
      [agencyCode, siteCode, run.id]
    );

    const allLookupRows: LookupInsertRow[] = [];
    for (const f of lookupFiles) {
      const parsed = f.parsed;
      const rows = parseLookupXml(
        f.content,
        parsed?.agencyCode ?? null,
        parsed?.siteCode ?? null,
        run.id
      );
      for (const r of rows) {
        allLookupRows.push({
          ...r,
          lookup_scope: parsed?.agencyCode ? 'agency' : 'generic',
        });
      }
    }
    if (allLookupRows.length > 0) {
      await lookupRepository.insertMany(allLookupRows);
    }

    const lookupMap = buildLookupMap(
      allLookupRows.map((r) => ({
        lookup_group: r.lookup_group,
        lookup_key: r.lookup_key,
        lookup_value: r.lookup_value,
      }))
    );

    await pool.query('BEGIN');
    try {
      await agencyRepository.deleteByAgencyAndSite(agencyCode, siteCode);
      await agentRepository.deleteByAgencyAndSite(agencyCode, siteCode);
      await listingRepository.deleteByAgencyAndSite(agencyCode, siteCode);

      for (const f of agencyFiles) {
        const parsed = f.parsed;
        const rows = parseAgenciesXml(
          f.content,
          parsed?.agencyCode ?? null,
          parsed?.siteCode ?? null,
          run.id
        );
        const mapped = rows.map((r) => ({
          ...r,
          raw_json: r.raw_json,
        }));
        if (mapped.length > 0) await agencyRepository.insertMany(mapped);
      }

      for (const f of agentFiles) {
        const parsed = f.parsed;
        const rows = parseAgentsXml(
          f.content,
          parsed?.agencyCode ?? null,
          parsed?.siteCode ?? null,
          run.id
        );
        if (rows.length > 0) await agentRepository.insertMany(rows);
      }

      let totalListingsFound = 0;
      let totalListingsImported = 0;
      for (const f of annunciFiles) {
        const parsed = f.parsed;
        const rawListings = parseListingsXml(
          f.content,
          parsed?.agencyCode ?? null,
          parsed?.siteCode ?? null,
          run.id
        );
        totalListingsFound += rawListings.length;
        const resolved: ListingInsertRow[] = rawListings.map((raw) => {
          const rj = raw.raw_json as Record<string, unknown>;
          const zone =
            raw.zone ??
            resolveLookup(lookupMap, (rj?.zona_id ?? rj?.zone_id ?? rj?.id_zona) as string | number | null | undefined, ZONE_LOOKUP_GROUPS);
          const propertyType =
            raw.property_type ??
            resolveLookup(lookupMap, (rj?.tipo_immobile_id ?? rj?.tipologia_id) as string | number | null | undefined, PROPERTY_TYPE_LOOKUP_GROUPS);
          const contractType =
            raw.contract_type ??
            resolveLookup(lookupMap, (rj?.tipo_contratto_id ?? rj?.contratto_id) as string | number | null | undefined, CONTRACT_TYPE_LOOKUP_GROUPS);

          return {
            import_run_id: run.id,
            agency_code: parsed?.agencyCode ?? null,
            site_code: parsed?.siteCode ?? null,
            external_listing_id: raw.external_listing_id,
            title: raw.title,
            contract_type: contractType,
            property_type: propertyType,
            city: raw.city,
            province: raw.province,
            postal_code: raw.postal_code,
            address: raw.address,
            zone,
            price: raw.price,
            bedrooms: raw.bedrooms,
            bathrooms: raw.bathrooms,
            surface_m2: raw.surface_m2,
            description: raw.description,
            raw_json: raw.raw_json,
          };
        });
        const inserted = await listingRepository.insertMany(resolved);
        totalListingsImported += inserted;
      }

      await pool.query('COMMIT');
      await importRunRepository.completeImportRun(run.id, {
        totalListingsFound: totalListingsFound,
        totalListingsImported: totalListingsImported,
      });

      logger.info(
        { importRunId: run.id, totalListingsFound, totalListingsImported, agencyCode, siteCode },
        'Import completed successfully'
      );

      return {
        success: true,
        importRunId: run.id,
        agencyCode,
        siteCode,
        totalListingsFound,
        totalListingsImported,
      };
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err, importRunId: run.id }, 'Import failed');
    await importRunRepository.completeImportRun(run.id, {
      errorMessage: errMsg,
    });
    return {
      success: false,
      importRunId: run.id,
      agencyCode: null,
      siteCode: null,
      totalListingsFound: 0,
      totalListingsImported: 0,
      errorMessage: errMsg,
    };
  } finally {
    if (zipPath) await cleanTempFiles(zipPath);
  }
}
