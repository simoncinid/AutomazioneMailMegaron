import axios from 'axios';
import AdmZip from 'adm-zip';

const URL =
  'https://api.gestim.biz/feeds/sites/MG9kMERYOEZYcFladmpyd2puTmpHQT09OlVueE9nQ1o2YjF4VnliRkswOUxPR2ViVmM5bFNiZmtQanY4cHgxeGNUZGc9';

const KEYWORDS = ['zona', 'zone', 'quartiere', 'localita', 'località', 'frazione', 'macrozona'];

async function main() {
  console.log('Fetching ZIP from:', URL);
  const response = await axios.get(URL, {
    responseType: 'arraybuffer',
    validateStatus: () => true,
    maxRedirects: 5,
    timeout: 120_000,
    headers: {
      'User-Agent': 'GestimIntegrationTest/1.0',
      Accept: 'application/xml, application/zip, application/octet-stream, */*',
    },
  });

  console.log('Status:', response.status);
  const buf = Buffer.from(response.data);
  console.log('Downloaded bytes:', buf.length);

  const zip = new AdmZip(buf);
  const entries = zip.getEntries();

  console.log('ZIP entries:');
  for (const e of entries) {
    console.log('-', e.entryName, e.header && e.header.size);
  }

  console.log('\nScanning each XML for zone-related keywords...');
  for (const entry of entries) {
    if (!entry.entryName.toLowerCase().endsWith('.xml')) continue;
    const xml = entry.getData().toString('utf8');
    const lower = xml.toLowerCase();

    const found: string[] = [];
    for (const k of KEYWORDS) {
      if (lower.includes(k)) found.push(k);
    }

    if (found.length === 0) continue;

    console.log(`\n=== ENTRY: ${entry.entryName} ===`);
    console.log('Keywords found:', found.join(', '));

    // Per ogni keyword trovata, mostra qualche contesto testuale attorno
    for (const k of found) {
      const i = lower.indexOf(k);
      if (i === -1) continue;
      const start = Math.max(0, i - 200);
      const end = Math.min(xml.length, i + 200);
      console.log(`\n--- Context around "${k}" ---`);
      console.log(xml.slice(start, end));
    }
  }
}

main().catch((err) => {
  console.error('Error while scanning Gestim ZIP:', err);
  process.exit(1);
});
