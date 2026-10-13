/**
 * The visitor's theme choice. `system` is the default and means no
 * `data-theme` on `<html>`: glass-ui and our own tokens follow
 * `prefers-color-scheme`. `light` / `dark` force glass-ui's `data-theme` axis.
 * The choice lives in a cookie so the root layout renders the attribute on
 * the server, and the first paint is already in the right theme.
 */
export const THEME_COOKIE = 'FD_THEME';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Anything but `light` or `dark` (a missing or stale cookie) is `system`. */
export function parseTheme(value: string | undefined | null): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** The value for `<html data-theme>`: none for `system`. */
export function themeAttribute(theme: Theme): 'light' | 'dark' | undefined {
  return theme === 'system' ? undefined : theme;
}

/** The order the header button walks through. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}
