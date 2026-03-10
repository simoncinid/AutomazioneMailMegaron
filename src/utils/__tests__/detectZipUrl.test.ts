import { describe, it, expect } from 'vitest';
import { detectZipUrl } from '../detectZipUrl';

describe('detectZipUrl', () => {
  it('returns URL from preferred key "callback"', () => {
    expect(
      detectZipUrl({ callback: 'https://example.com/file.zip' })
    ).toBe('https://example.com/file.zip');
  });

  it('returns URL from preferred key "download_url"', () => {
    expect(
      detectZipUrl({ download_url: 'https://cdn.example.com/export.zip' })
    ).toBe('https://cdn.example.com/export.zip');
  });

  it('returns URL from preferred key "zip_url"', () => {
    expect(detectZipUrl({ zip_url: 'https://gestim.it/export.zip' })).toBe(
      'https://gestim.it/export.zip'
    );
  });

  it('returns URL when single query param is a URL', () => {
    expect(
      detectZipUrl({ file: 'https://example.com/single.zip' })
    ).toBe('https://example.com/single.zip');
  });

  it('returns first valid URL when multiple params exist', () => {
    expect(
      detectZipUrl({
        foo: 'bar',
        url: 'https://example.com/data.zip',
      })
    ).toBe('https://example.com/data.zip');
  });

  it('returns null when no URL in query', () => {
    expect(detectZipUrl({ foo: 'bar', baz: 'qux' })).toBeNull();
  });

  it('returns null for empty query', () => {
    expect(detectZipUrl({})).toBeNull();
  });

  it('handles array values - uses first element', () => {
    expect(
      detectZipUrl({ url: ['https://example.com/first.zip', 'https://example.com/second.zip'] })
    ).toBe('https://example.com/first.zip');
  });

  it('rejects non-URL values', () => {
    expect(detectZipUrl({ url: 'not-a-url' })).toBeNull();
    expect(detectZipUrl({ url: 'ftp://old.proto' })).toBeNull();
  });

  it('accepts http URLs', () => {
    expect(detectZipUrl({ url: 'http://localhost/file.zip' })).toBe(
      'http://localhost/file.zip'
    );
  });
});
