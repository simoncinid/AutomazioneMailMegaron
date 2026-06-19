import axios from 'axios';
import AdmZip from 'adm-zip';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { parseListingsXml } from '../src/services/xmlParserService';

const DEFAULT_LOG_URLS = [
  'https://api.gestim.biz/feeds/sites/cWIxRmMxYzRoeVhETGVSSW0yTktmUT09OnUyVVBPLzUrN',
  'https://api.gestim.biz/feeds/sites/TUpNdFd6ajRwbkFMVjE5dGVha2xCZz09OkcwNE8wM3lXN',
  'https://api.gestim.biz/feeds/sites/aVMzdFE4REhGbWMzaDZWT0dJU1dxUT09OkpnWmRaR3lBM',
];

const FEED_URL_REGEX = /https:\/\/api\.gestim\.biz\/feeds\/sites\/[A-Za-z0-9_\-+=/%]+/g;

function normalizeUrl(raw: string): string {
  return raw.replace(/["'`),.;]+$/g, '').trim();
}

async function urlsFromLogFile(logPath: string): Promise<string[]> {
  const content = await readFile(logPath, 'utf8');
  const matches = content.match(FEED_URL_REGEX) ?? [];
  return Array.from(new Set(matches.map(normalizeUrl)));
}

function countByCity(listings: Array<{ city: string | null }>): Array<{ city: string; count: number }> {
  const map = new Map<string, number>();
  for (const l of listings) {
    const city = (l.city ?? '').trim() || '__unknown__';
    map.set(city, (map.get(city) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

function parseArgs(argv: string[]): { logPath: string | null; explicitUrls: string[]; outPath: string | null } {
  let logPath: string | null = null;
  let outPath: string | null = null;
  const explicitUrls: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--log') {
      const v = argv[i + 1];
      if (!v) throw new Error('Missing value after --log');
      logPath = v;
      i += 1;
      continue;
    }
    if (a === '--url') {
      const v = argv[i + 1];
      if (!v) throw new Error('Missing value after --url');
      explicitUrls.push(normalizeUrl(v));
      i += 1;
      continue;
    }
    if (a === '--out') {
      const v = argv[i + 1];
      if (!v) throw new Error('Missing value after --out');
      outPath = v;
      i += 1;
      continue;
    }
  }

  return { logPath, explicitUrls, outPath };
}

async function analyzeZipFromUrl(url: string): Promise<{
  url: string;
  status: number;
  contentType: string;
  zipEntries: number;
  xmlEntries: number;
  listingXmlEntries: number;
  listings: Array<{ externalListingId: string; idAnnuncioGestim: string | null; city: string | null; title: string | null }>;
}> {
  console.log(`\n=== URL: ${url} ===`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    validateStatus: () => true,
    maxRedirects: 5,
    timeout: 120_000,
    headers: {
      'User-Agent': 'GestimIntegrationTest/1.0',
      Accept: 'application/zip, application/octet-stream, application/xml, */*',
    },
  });

  const contentType = String(response.headers['content-type'] || '');
  console.log(`status=${response.status} content-type=${contentType} bytes=${Buffer.byteLength(response.data)}`);

  if (response.status < 200 || response.status >= 300) {
    console.log('skip: non-2xx response');
    return {
      url,
      status: response.status,
      contentType,
      zipEntries: 0,
      xmlEntries: 0,
      listingXmlEntries: 0,
      listings: [],
    };
  }

  const zip = new AdmZip(Buffer.from(response.data));
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const xmlEntries = entries.filter((e) => e.entryName.toLowerCase().endsWith('.xml'));

  console.log(`files: total=${entries.length} xml=${xmlEntries.length}`);

  const allListings: Array<{ city: string | null }> = [];
  const allListingRows: Array<{
    externalListingId: string;
    idAnnuncioGestim: string | null;
    city: string | null;
    title: string | null;
  }> = [];
  let parsedXmlCount = 0;

  for (const entry of xmlEntries) {
    const buf = entry.getData();
    let listings: ReturnType<typeof parseListingsXml> = [];
    try {
      listings = parseListingsXml(buf, null, null, 0);
    } catch {
      continue;
    }

    if (listings.length > 0) {
      parsedXmlCount += 1;
      for (const l of listings) {
        allListings.push({ city: l.city });
        allListingRows.push({
          externalListingId: l.external_listing_id,
          idAnnuncioGestim: l.id_annuncio_gestim,
          city: l.city,
          title: l.title,
        });
      }
      console.log(`  - ${entry.entryName}: listings=${listings.length}`);
    }
  }

  console.log(`parsed listing XML files: ${parsedXmlCount}`);
  console.log(`total listings parsed: ${allListings.length}`);

  const cityStats = countByCity(allListings);
  const nonPisa = cityStats.filter((s) => s.city.toLowerCase() !== 'pisa' && s.city !== '__unknown__');

  console.log('top cities:');
  for (const row of cityStats.slice(0, 20)) {
    console.log(`  ${row.city}: ${row.count}`);
  }

  if (nonPisa.length > 0) {
    console.log(`non-Pisa cities found: YES (${nonPisa.length} cities)`);
  } else {
    console.log('non-Pisa cities found: NO');
  }

  return {
    url,
    status: response.status,
    contentType,
    zipEntries: entries.length,
    xmlEntries: xmlEntries.length,
    listingXmlEntries: parsedXmlCount,
    listings: allListingRows,
  };
}

async function main(): Promise<void> {
  const { logPath, explicitUrls, outPath } = parseArgs(process.argv.slice(2));

  let urls: string[] = [];
  if (explicitUrls.length > 0) {
    urls = explicitUrls;
  } else if (logPath) {
    urls = await urlsFromLogFile(logPath);
  } else {
    urls = DEFAULT_LOG_URLS;
  }

  urls = Array.from(new Set(urls.map(normalizeUrl))).filter(Boolean);

  if (urls.length === 0) {
    console.log('No Gestim feed URLs found.');
    return;
  }

  console.log(`Analyzing ${urls.length} URL(s)...`);
  const reports: Array<{
    url: string;
    status: number;
    contentType: string;
    zipEntries: number;
    xmlEntries: number;
    listingXmlEntries: number;
    listings: Array<{ externalListingId: string; idAnnuncioGestim: string | null; city: string | null; title: string | null }>;
  }> = [];

  for (const url of urls) {
    try {
      const report = await analyzeZipFromUrl(url);
      reports.push(report);
    } catch (err) {
      console.log(`error on ${url}: ${err instanceof Error ? err.message : String(err)}`);
      reports.push({
        url,
        status: 0,
        contentType: '',
        zipEntries: 0,
        xmlEntries: 0,
        listingXmlEntries: 0,
        listings: [],
      });
    }
  }

  const finalOutPath = outPath ?? path.join('tmp', 'gestim-log-url-listings.json');
  await mkdir(path.dirname(finalOutPath), { recursive: true });
  await writeFile(
    finalOutPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        urlsAnalyzed: urls.length,
        reports,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\nSaved extracted listings report to: ${finalOutPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
