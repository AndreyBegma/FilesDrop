/** Decision 4: executables are refused by extension... */
export const DENIED_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe',
  'scr',
  'bat',
  'cmd',
  'com',
  'cpl',
  'msi',
  'msp',
  'apk',
  'jar',
  'vbs',
  'vbe',
  'js',
  'wsf',
  'ps1',
  'psm1',
  'hta',
  'lnk',
  'pif',
  'reg',
  'dll',
  'sys',
]);

/** Bytes kept from the start of a file for magic-byte checks and sniffing. */
export const HEAD_BYTES = 4100;

const MAX_NAME_LENGTH = 200;
const MAX_EXT_LENGTH = 10;

/**
 * Turns a client-supplied name into something safe to store and to put in a
 * Content-Disposition header: no path, no control characters, bounded length.
 */
export const sanitizeName = (raw: string): string => {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = Array.from(base.normalize('NFC'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code < 0xa0);
    })
    .join('')
    .trim()
    .replace(/^\.+/, '');
  const bounded = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('');
  return bounded || 'file';
};

/** Lowercase extension without the dot; "" when absent or not plain ASCII. */
export const extOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  return ext.length <= MAX_EXT_LENGTH && /^[a-z0-9]+$/.test(ext) ? ext : '';
};

export const isDeniedExtension = (ext: string): boolean =>
  DENIED_EXTENSIONS.has(ext.toLowerCase());

/** ...and by magic bytes: `MZ` (PE/DOS) and `\x7fELF`. */
export const hasExecutableMagic = (head: Uint8Array): boolean =>
  (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) ||
  (head.length >= 4 &&
    head[0] === 0x7f &&
    head[1] === 0x45 &&
    head[2] === 0x4c &&
    head[3] === 0x46);

/** Types `/f/` serves inline; everything else is an attachment. */
export const isInlineMime = (mime: string): boolean => {
  const type = mime.split(';')[0].trim().toLowerCase();
  if (type === 'image/svg+xml') return false;
  return (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    type.startsWith('audio/') ||
    type === 'application/pdf' ||
    type === 'text/plain'
  );
};

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  pdf: 'application/pdf',
  txt: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  zip: 'application/zip',
};

export const OCTET_STREAM = 'application/octet-stream';

/** Fallback when the bytes alone do not identify the type. */
export const mimeFromExt = (ext: string): string =>
  MIME_BY_EXT[ext] ?? OCTET_STREAM;

/**
 * Types whose files always start with a signature the sniffer recognises.
 * When the name claims one of these and the bytes do not carry it, the name
 * is lying (an HTML page called `cat.png`), so the extension is not trusted.
 */
const hasSignature = (mime: string): boolean =>
  mime !== 'image/svg+xml' &&
  (mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf' ||
    mime === 'application/zip');

/**
 * The type to store and serve: what the bytes say when the sniffer knows
 * them, else what the extension says — unless the extension names a binary
 * format the bytes plainly are not, which falls back to octet-stream (and so
 * to `attachment`).
 */
export const resolveMime = (
  ext: string,
  sniffed: { mime: string } | undefined,
): string => {
  if (sniffed) return sniffed.mime;
  const claimed = mimeFromExt(ext);
  return hasSignature(claimed) ? OCTET_STREAM : claimed;
};

const asciiFallback = (name: string): string =>
  name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

/** RFC 5987 / 8187 `ext-value` encoding. */
const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export const contentDisposition = (name: string, inline: boolean): string =>
  `${inline ? 'inline' : 'attachment'}; filename="${asciiFallback(name)}"; filename*=UTF-8''${encodeRfc5987(name)}`;

/** Decision 4: sent with every raw download. */
export const RAW_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
};
