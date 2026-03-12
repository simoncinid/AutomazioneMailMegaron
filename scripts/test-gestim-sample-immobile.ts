import axios from 'axios';
import AdmZip from 'adm-zip';

const URL =
  'https://api.gestim.biz/feeds/sites/MG9kMERYOEZYcFladmpyd2puTmpHQT09OlVueE9nQ1o2YjF4VnliRkswOUxPR2ViVmM5bFNiZmtQanY4cHgxeGNUZGc9';

async function main() {
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

  const zip = new AdmZip(Buffer.from(response.data));
  const entry = zip.getEntries().find((e) => /annunci\.xml$/i.test(e.entryName));
  if (!entry) {
    console.error('No *_annunci.xml in ZIP');
    return;
  }

  const xml = entry.getData().toString('utf8');
  const immobileRegex = /<immobile>[\s\S]*?<\/immobile>/;
  const m = immobileRegex.exec(xml);
  if (!m) {
    console.error('No <immobile> block found');
    return;
  }

  console.log('---- SAMPLE IMMOBILE ----');
  console.log(m[0]);
  console.log('---- END SAMPLE ----');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
