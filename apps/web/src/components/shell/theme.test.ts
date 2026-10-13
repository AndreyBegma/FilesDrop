/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { nextTheme, parseTheme, themeAttribute } from './theme';

describe('theme', () => {
  test('a missing or unknown cookie means system', () => {
    expect(parseTheme(undefined)).toBe('system');
    expect(parseTheme('sepia')).toBe('system');
    expect(parseTheme('dark')).toBe('dark');
  });

  test('system renders no data-theme; light and dark force it', () => {
    expect(themeAttribute('system')).toBeUndefined();
    expect(themeAttribute('light')).toBe('light');
    expect(themeAttribute('dark')).toBe('dark');
  });

  test('the button walks system → light → dark → system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});
