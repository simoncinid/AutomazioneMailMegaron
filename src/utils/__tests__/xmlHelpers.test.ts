import { describe, it, expect } from 'vitest';
import {
  ensureArray,
  getNestedValue,
  toNullableString,
  toNullableNumber,
} from '../xmlHelpers';

describe('ensureArray', () => {
  it('returns empty array for null', () => {
    expect(ensureArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(ensureArray(undefined)).toEqual([]);
  });

  it('returns array as-is for array input', () => {
    const arr = [1, 2, 3];
    expect(ensureArray(arr)).toBe(arr);
  });

  it('wraps single value in array', () => {
    expect(ensureArray('hello')).toEqual(['hello']);
    expect(ensureArray(42)).toEqual([42]);
    expect(ensureArray({ a: 1 })).toEqual([{ a: 1 }]);
  });
});

describe('getNestedValue', () => {
  it('returns value at path', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getNestedValue(obj, ['a', 'b', 'c'])).toBe(42);
  });

  it('returns undefined for missing path', () => {
    const obj = { a: { b: {} } };
    expect(getNestedValue(obj, ['a', 'b', 'c'])).toBeUndefined();
  });

  it('returns undefined for null/undefined obj', () => {
    expect(getNestedValue(null, ['a'])).toBeUndefined();
    expect(getNestedValue(undefined, ['a'])).toBeUndefined();
  });

  it('returns root value for empty path', () => {
    const obj = { x: 1 };
    expect(getNestedValue(obj, [])).toBe(obj);
  });
});

describe('toNullableString', () => {
  it('returns null for null/undefined', () => {
    expect(toNullableString(null)).toBeNull();
    expect(toNullableString(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toNullableString('')).toBeNull();
    expect(toNullableString('   ')).toBeNull();
  });

  it('returns trimmed string', () => {
    expect(toNullableString('  hello  ')).toBe('hello');
  });

  it('converts number to string', () => {
    expect(toNullableString(123)).toBe('123');
  });
});

describe('toNullableNumber', () => {
  it('returns null for null/undefined', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
  });

  it('returns number as-is', () => {
    expect(toNullableNumber(42)).toBe(42);
  });

  it('parses numeric string', () => {
    expect(toNullableNumber('123')).toBe(123);
  });

  it('returns null for NaN', () => {
    expect(toNullableNumber('abc')).toBeNull();
  });
});
