import axios from 'axios';
import AdmZip from 'adm-zip';

const URL =
  'https://api.gestim.biz/feeds/sites/QjdXS0tqQmV1NEwxeVRpTHlPZGQwUT09OlpQenlVWVhvckZZdmxZSkV3RDdMWVlQOGtNRHZwcmV3R0lsb21tMEhZaTA9';

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

  const annunciEntry = entries.find((e) => /annunci\.xml$/i.test(e.entryName));
  if (!annunciEntry) {
    console.log('Nessun file *_annunci.xml trovato nello ZIP');
    return;
  }

  console.log('Using announcements entry:', annunciEntry.entryName);
  const xml = annunciEntry.getData().toString('utf8');

  const immobileRegex = /<immobile>[\s\S]*?<\/immobile>/g;
  const frazioneRegex = /<frazione>(.*?)<\/frazione>/i;

  const frazioni = new Map<string, number>();
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = immobileRegex.exec(xml))) {
    const block = match[0];
    const frazMatch = frazioneRegex.exec(block);
    const value = frazMatch ? frazMatch[1].trim() : '';
    const key = value === '' ? '(vuota)' : value;
    frazioni.set(key, (frazioni.get(key) || 0) + 1);
    count += 1;
  }

  console.log(`Analizzati ${count} immobili.`);
  console.log('Valori distinti di <frazione> trovati (valore -> conteggio):');
  for (const [val, c] of frazioni.entries()) {
    console.log(`- ${val}: ${c}`);
  }
}

main().catch((err) => {
  console.error('Error while scanning frazione from Gestim XML:', err);
  process.exit(1);
});
