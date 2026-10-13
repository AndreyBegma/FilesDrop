const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/**
 * `1536` → `1.5 kB`, in the reader's locale. The same rule as glass-ui's
 * `formatBytes`, which lives in a client module and so cannot run in a
 * server component or `generateMetadata`.
 */
export function formatBytes(bytes: number, locale?: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: UNITS[unit],
    // `21 B`, not `21 byte`; the larger units read fine as `short`.
    unitDisplay: unit === 0 ? 'narrow' : 'short',
    maximumFractionDigits: unit === 0 || value >= 10 ? 0 : 1,
  }).format(value);
}
