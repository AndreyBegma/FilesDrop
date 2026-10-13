import {
  contentDisposition,
  extOf,
  hasExecutableMagic,
  isDeniedExtension,
  isInlineMime,
  mimeFromExt,
  sanitizeName,
} from './file-policy';
import { filesConfigFromEnv } from './files.config';

describe('file policy', () => {
  it.each([
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
    'EXE',
  ])('denies .%s', (ext) => {
    expect(isDeniedExtension(ext)).toBe(true);
  });

  it.each([
    'png',
    'txt',
    'html',
    'svg',
    'zip',
    'json',
    '',
  ])('allows .%s', (ext) => {
    expect(isDeniedExtension(ext)).toBe(false);
  });

  it('spots MZ and ELF magic bytes', () => {
    expect(hasExecutableMagic(Buffer.from('MZ\x00\x00'))).toBe(true);
    expect(hasExecutableMagic(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2]))).toBe(
      true,
    );
    expect(hasExecutableMagic(Buffer.from('M'))).toBe(false);
    expect(hasExecutableMagic(Buffer.from('hello'))).toBe(false);
    expect(hasExecutableMagic(Buffer.from([0x7f, 0x45, 0x4c]))).toBe(false);
  });

  it.each([
    ['image/png', true],
    ['image/jpeg', true],
    ['image/svg+xml', false],
    ['video/mp4', true],
    ['audio/mpeg', true],
    ['application/pdf', true],
    ['text/plain', true],
    ['text/html', false],
    ['application/xml', false],
    ['application/octet-stream', false],
  ])('inline(%s) = %s', (mime, inline) => {
    expect(isInlineMime(mime)).toBe(inline);
  });

  it('extracts lowercase plain extensions of at most 10 chars', () => {
    expect(extOf('Cat.PNG')).toBe('png');
    expect(extOf('archive.tar.gz')).toBe('gz');
    expect(extOf('README')).toBe('');
    expect(extOf('.bashrc')).toBe('');
    expect(extOf('trailing.')).toBe('');
    expect(extOf('x.abcdefghijk')).toBe('');
    expect(extOf('x.ab-c')).toBe('');
  });

  it('sanitizes names: no paths, no control characters, no leading dots', () => {
    expect(sanitizeName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeName('C:\\Users\\me\\cat.png')).toBe('cat.png');
    expect(sanitizeName('a\r\nb\u0000c.txt')).toBe('abc.txt');
    expect(sanitizeName('...hidden')).toBe('hidden');
    expect(sanitizeName('')).toBe('file');
    expect(sanitizeName('x'.repeat(500))).toHaveLength(200);
  });

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeFromExt('svg')).toBe('image/svg+xml');
    expect(mimeFromExt('weird')).toBe('application/octet-stream');
  });

  it('builds an RFC 5987 Content-Disposition with an ASCII fallback', () => {
    expect(contentDisposition("it's (1).pdf", true)).toBe(
      `inline; filename="it's (1).pdf"; filename*=UTF-8''it%27s%20%281%29.pdf`,
    );
    expect(contentDisposition('日本.html', false)).toBe(
      `attachment; filename="__.html"; filename*=UTF-8''%E6%97%A5%E6%9C%AC.html`,
    );
  });
});

describe('filesConfigFromEnv', () => {
  it('has the documented defaults, including the 30 s fetch budget', () => {
    const config = filesConfigFromEnv(() => undefined);
    expect(config).toMatchObject({
      maxTotalBytes: 10737418240,
      rateLimit: 30,
      rateWindowMs: 600000,
      trustCfHeader: false,
      fetchTimeoutMs: 30_000,
      maxRedirects: 3,
    });
    expect(config.uploadDir).toMatch(/\.uploads$/);
  });

  it('reads the environment and refuses garbage numbers', () => {
    const env: Record<string, string> = {
      UPLOAD_DIR: '/data/uploads',
      MAX_TOTAL_BYTES: '1048576',
      TRUST_CF_HEADER: 'true',
    };
    expect(filesConfigFromEnv((key) => env[key])).toMatchObject({
      uploadDir: '/data/uploads',
      maxTotalBytes: 1048576,
      trustCfHeader: true,
    });
    expect(() =>
      filesConfigFromEnv((key) => (key === 'RATE_LIMIT' ? '-1' : undefined)),
    ).toThrow(/RATE_LIMIT/);
  });
});
