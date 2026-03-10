import { describe, it, expect } from 'vitest';
import { parseGestimFilename } from '../parseGestimFilename';

describe('parseGestimFilename', () => {
  it('parses 3898_270_annunci.xml', () => {
    expect(parseGestimFilename('3898_270_annunci.xml')).toEqual({
      agencyCode: '3898',
      siteCode: '270',
      kind: 'annunci',
    });
  });

  it('parses 3898_270_agenzie.xml', () => {
    expect(parseGestimFilename('3898_270_agenzie.xml')).toEqual({
      agencyCode: '3898',
      siteCode: '270',
      kind: 'agenzie',
    });
  });

  it('parses 3898_270_lookup.xml', () => {
    expect(parseGestimFilename('3898_270_lookup.xml')).toEqual({
      agencyCode: '3898',
      siteCode: '270',
      kind: 'lookup',
    });
  });

  it('parses 270_lookup.xml (generic lookup)', () => {
    expect(parseGestimFilename('270_lookup.xml')).toEqual({
      agencyCode: null,
      siteCode: '270',
      kind: 'lookup',
    });
  });

  it('parses 270_agenzie.xml', () => {
    expect(parseGestimFilename('270_agenzie.xml')).toEqual({
      agencyCode: null,
      siteCode: '270',
      kind: 'agenzie',
    });
  });

  it('returns null for non-XML file', () => {
    expect(parseGestimFilename('readme.txt')).toBeNull();
  });

  it('returns null for unknown kind', () => {
    expect(parseGestimFilename('3898_270_other.xml')).toBeNull();
  });

  it('handles case insensitivity for extension', () => {
    expect(parseGestimFilename('3898_270_annunci.XML')).toEqual({
      agencyCode: '3898',
      siteCode: '270',
      kind: 'annunci',
    });
  });
});
