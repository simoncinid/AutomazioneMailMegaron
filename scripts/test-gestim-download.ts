import axios from 'axios';
import AdmZip from 'adm-zip';

async function main() {
  const url =
    'https://api.gestim.biz/feeds/sites/MG9kMERYOEZYcFladmpyd2puTmpHQT09OlVueE9nQ1o2YjF4VnliRkswOUxPR2ViVmM5bFNiZmtQanY4cHgxeGNUZGc9';

  console.log('Fetching:', url);

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
  console.log('Content-Type:', response.headers['content-type']);

  const buf = Buffer.from(response.data);
  console.log('Downloaded bytes:', buf.length);

  const zip = new AdmZip(buf);
  const entries = zip.getEntries();

  console.log('ZIP entries:');
  for (const e of entries) {
    console.log('-', e.entryName, e.header && e.header.size);
  }

  const xmlEntry = entries.find((e) => /annunci\.xml$/i.test(e.entryName)) || entries[0];
  if (!xmlEntry) {
    console.log('No entries found in ZIP');
    return;
  }

  console.log('\nReading entry:', xmlEntry.entryName);
  const xmlBuffer = xmlEntry.getData();
  const xmlText = xmlBuffer.toString('utf8');

  console.log('---- XML START (first 2000 chars) ----');
  console.log(xmlText.slice(0, 2000));
  console.log('---- XML END (truncated) ----');
}

main().catch((err) => {
  console.error('Error while fetching/reading Gestim ZIP:', err);
  process.exit(1);
});
