import axios from 'axios';
import AdmZip from 'adm-zip';

async function main() {
  const url =
    'https://api.gestim.biz/feeds/sites/MG9kMERYOEZYcFladmpyd2puTmpHQT09OlVueE9nQ1o2YjF4VnliRkswOUxPR2ViVmM5bFNiZmtQanY4cHgxeGNUZGc9';

  console.log('Fetching ZIP from:', url);

  const response = await axios.get(url, {
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

  const lookupEntry = entries.find((e) => /lookup\.xml$/i.test(e.entryName));
  if (!lookupEntry) {
    console.log('Nessun file *_lookup.xml trovato nello ZIP');
    return;
  }

  console.log('\nReading lookup entry:', lookupEntry.entryName);
  const xmlBuffer = lookupEntry.getData();
  const xmlText = xmlBuffer.toString('utf8');

  console.log('---- LOOKUP XML START (first 3000 chars) ----');
  console.log(xmlText.slice(0, 3000));
  console.log('---- LOOKUP XML END (truncated) ----');

  // Grep molto semplice per parole chiave tipiche di zona/area
  const lower = xmlText.toLowerCase();
  const keywords = ['zona', 'quartiere', 'localita', 'quartiere', 'frazione'];
  console.log('\nParole chiave presenti nei lookup:');
  for (const k of keywords) {
    console.log(`- ${k}:`, lower.includes(k) ? 'TROVATO' : 'no');
  }
}

main().catch((err) => {
  console.error('Error while fetching/reading Gestim lookup:', err);
  process.exit(1);
});
