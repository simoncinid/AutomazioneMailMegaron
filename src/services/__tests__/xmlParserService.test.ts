import { describe, expect, it } from 'vitest';
import { parseAgenciesXml, parseAgentsXml, parseListingsXml } from '../xmlParserService';

function buf(xml: string): Buffer {
  return Buffer.from(xml, 'utf-8');
}

describe('xmlParserService', () => {
  it('parses listings with uppercase tags under import/immobili', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <Import>
        <Immobili>
          <Immobile>
            <ID>123</ID>
            <Codice>ABC123</Codice>
            <Citta>Pisa</Citta>
            <Prezzo>250000</Prezzo>
          </Immobile>
        </Immobili>
      </Import>`;

    const rows = parseListingsXml(buf(xml), '5912', '804', 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.external_listing_id).toBe('123');
    expect(rows[0]?.id_annuncio_gestim).toBe('ABC123');
    expect(rows[0]?.city).toBe('Pisa');
    expect(rows[0]?.price).toBe(250000);
  });

  it('parses listings with namespace-prefixed tags', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <g:export xmlns:g="urn:test">
        <g:annunci>
          <g:annuncio>
            <g:id>999</g:id>
            <g:Codice>X999</g:Codice>
            <g:citta>Roma</g:citta>
          </g:annuncio>
        </g:annunci>
      </g:export>`;

    const rows = parseListingsXml(buf(xml), '5913', '804', 2);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.external_listing_id).toBe('999');
    expect(rows[0]?.id_annuncio_gestim).toBe('X999');
    expect(rows[0]?.city).toBe('Roma');
  });

  it('parses agencies from nested agenzie/agenzia structure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <export>
        <agenzie>
          <agenzia>
            <id>5912</id>
            <nome>Agenzia Test</nome>
            <email>info@test.it</email>
          </agenzia>
        </agenzie>
      </export>`;

    const rows = parseAgenciesXml(buf(xml), '5912', '804', 3);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.external_agency_id).toBe('5912');
    expect(rows[0]?.name).toBe('Agenzia Test');
  });

  it('parses agents from nested agenti/agente structure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <export>
        <agenti>
          <agente>
            <id>777</id>
            <agenzia_id>5912</agenzia_id>
            <nome>Mario Rossi</nome>
            <email>mario@test.it</email>
          </agente>
        </agenti>
      </export>`;

    const rows = parseAgentsXml(buf(xml), '5912', '804', 4);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.external_agent_id).toBe('777');
    expect(rows[0]?.agency_external_id).toBe('5912');
    expect(rows[0]?.name).toBe('Mario Rossi');
  });
});
