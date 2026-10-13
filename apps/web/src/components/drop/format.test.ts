/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { formatBytes } from './format';

const NBSP = ' ';

describe('formatBytes', () => {
  test('reads 21 bytes as "21 B", never "21 byte" or "21B"', () => {
    expect(formatBytes(21, 'en')).toBe(`21${NBSP}B`);
  });

  test('uses each locale’s own unit symbols and decimal mark', () => {
    expect(formatBytes(21, 'uk')).toBe(`21${NBSP}Б`);
    expect(formatBytes(1536, 'en')).toBe(`1.5${NBSP}KB`);
    expect(formatBytes(1536, 'uk')).toBe(`1,5${NBSP}КБ`);
    expect(formatBytes(95 * 1024 * 1024, 'uk')).toBe(`95${NBSP}МБ`);
  });

  test('drops the decimal from 10 up and falls back to English units', () => {
    expect(formatBytes(20 * 1024 + 300, 'en')).toBe(`20${NBSP}KB`);
    expect(formatBytes(2048, 'de')).toBe(`2${NBSP}KB`);
    expect(formatBytes(-5)).toBe(`0${NBSP}B`);
  });
});
