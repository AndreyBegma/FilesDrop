/** Unit symbols per language: what a reader of that language expects to see. */
const UNITS: Readonly<Record<string, readonly string[]>> = {
  en: ['B', 'KB', 'MB', 'GB'],
  uk: ['Б', 'КБ', 'МБ', 'ГБ'],
};

/**
 * `21` → `21 B`, `1536` → `1.5 KB` (`1,5 КБ` in uk). Binary steps, the
 * number formatted by `Intl` and the unit from the table above. `Intl`'s own
 * byte units are no good here: `short` reads `21 byte` in English and
 * `narrow` drops the space (`21B`).
 *
 * Pure, so it runs in server components and `generateMetadata` too.
 */
export function formatBytes(bytes: number, locale = 'en'): string {
  const units = UNITS[locale.slice(0, 2).toLowerCase()] ?? UNITS.en;
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit === 0 || value >= 10 ? 0 : 1,
  }).format(value);
  // A no-break space: the number never wraps away from its unit.
  return `${number} ${units[unit]}`;
}
