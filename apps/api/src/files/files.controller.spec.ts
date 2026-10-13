import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type FileMeta,
  MAX_FILE_BYTES,
  type UploadResult,
} from '@filesdrop/shared';
import { FilesCleanupService } from './files-cleanup.service';
import {
  createFilesTestApp,
  type FilesTestApp,
  pngBytes,
  uploadForm,
} from './testing/files-test-app';

const CSP =
  "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";

describe('Files API', () => {
  let t: FilesTestApp;

  const upload = (bytes: Uint8Array, name: string, ttl?: string) =>
    fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      body: uploadForm(bytes, name, ttl),
    });

  const uploadOk = async (bytes: Uint8Array, name: string) => {
    const res = await upload(bytes, name);
    expect(res.status).toBe(201);
    return (await res.json()) as UploadResult;
  };

  afterEach(async () => {
    jest.useRealTimers();
    await t?.close();
  });

  describe('with defaults', () => {
    beforeEach(async () => {
      t = await createFilesTestApp();
    });

    it('uploads a 1 KB PNG and serves the identical bytes inline with nosniff', async () => {
      const bytes = pngBytes(1024);
      const res = await upload(bytes, 'cat.png', '1h');

      expect(res.status).toBe(201);
      const body = (await res.json()) as UploadResult;
      expect(body.slug).toMatch(/^[0-9A-Za-z]{8}$/);
      expect(body.inline).toBe(true);
      expect(body.deleteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(body).toMatchObject({
        name: 'cat.png',
        ext: 'png',
        mime: 'image/png',
        size: 1024,
      });
      expect(Date.parse(body.expiresAt) - Date.parse(body.createdAt)).toBe(
        3_600_000,
      );

      const raw = await fetch(`${t.baseUrl}/f/${body.slug}.png`);
      expect(raw.status).toBe(200);
      expect(Buffer.from(await raw.arrayBuffer()).equals(bytes)).toBe(true);
      expect(raw.headers.get('content-type')).toBe('image/png');
      expect(raw.headers.get('x-content-type-options')).toBe('nosniff');
      expect(raw.headers.get('content-security-policy')).toBe(CSP);
      expect(raw.headers.get('cache-control')).toBe('public, max-age=300');
      expect(raw.headers.get('content-disposition')).toBe(
        `inline; filename="cat.png"; filename*=UTF-8''cat.png`,
      );
    });

    it('stores only the sha256 of the delete token', async () => {
      const body = await uploadOk(pngBytes(), 'a.png');
      const row = t.repository.rows.get(body.slug);
      expect(row?.deleteTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row?.deleteTokenHash).not.toContain(body.deleteToken);
    });

    it('defaults ttl to 24h and rejects an unknown ttl with 400 leaving no tmp file', async () => {
      const ok = await uploadOk(pngBytes(), 'a.png');
      expect(Date.parse(ok.expiresAt) - Date.parse(ok.createdAt)).toBe(
        86_400_000,
      );

      const bad = await upload(pngBytes(), 'b.png', '2h');
      expect(bad.status).toBe(400);
      expect(await t.tmpEntries()).toEqual([]);
      expect(await t.storedEntries()).toEqual([ok.slug]);
    });

    it('answers 400 when no file is sent', async () => {
      const form = new FormData();
      form.append('ttl', '1h');
      const res = await fetch(`${t.baseUrl}/api/files`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);
    });

    it('rejects 95 MB + 1 byte with 413 and leaves no row and no file, not even in .tmp', async () => {
      const res = await upload(new Uint8Array(MAX_FILE_BYTES + 1), 'big.bin');

      expect(res.status).toBe(413);
      expect(t.repository.rows.size).toBe(0);
      expect(await t.tmpEntries()).toEqual([]);
      expect(await t.storedEntries()).toEqual([]);
    }, 60_000);

    it('accepts exactly 95 MB', async () => {
      const body = await uploadOk(new Uint8Array(MAX_FILE_BYTES), 'edge.bin');
      expect(body.size).toBe(MAX_FILE_BYTES);
    }, 60_000);

    it('rejects evil.exe with 415', async () => {
      const res = await upload(Buffer.from('harmless text'), 'evil.exe');
      expect(res.status).toBe(415);
      expect(await res.json()).toMatchObject({
        statusCode: 415,
        reason: 'denied_extension',
      });
      expect(t.repository.rows.size).toBe(0);
      expect(await t.tmpEntries()).toEqual([]);
    });

    it('rejects photo.jpg whose bytes start with MZ with 415', async () => {
      const bytes = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(512, 0x90)]);
      const res = await upload(bytes, 'photo.jpg');
      expect(res.status).toBe(415);
      expect(await res.json()).toMatchObject({ reason: 'executable_content' });
      expect(await t.tmpEntries()).toEqual([]);
      expect(await t.storedEntries()).toEqual([]);
    });

    it('rejects an ELF binary with 415 whatever its name', async () => {
      const bytes = Buffer.concat([
        Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
        Buffer.alloc(64),
      ]);
      const res = await upload(bytes, 'notes.txt');
      expect(res.status).toBe(415);
    });

    it.each([
      ['page.html', '<script>alert(1)</script>', 'text/html'],
      [
        'logo.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        'image/svg+xml',
      ],
    ])('accepts %s but serves it as an attachment with the sandbox CSP', async (name, content, mime) => {
      const body = await uploadOk(Buffer.from(content), name);
      expect(body.inline).toBe(false);
      expect(body.mime).toBe(mime);

      const raw = await fetch(`${t.baseUrl}/f/${body.slug}.${body.ext}`);
      expect(raw.status).toBe(200);
      expect(raw.headers.get('content-type')).toBe(mime);
      expect(raw.headers.get('content-disposition')).toMatch(/^attachment; /);
      expect(raw.headers.get('content-security-policy')).toBe(CSP);
      expect(raw.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('encodes a non-ASCII name with an RFC 5987 filename*', async () => {
      const body = await uploadOk(Buffer.from('привет'), 'котик "1".txt');
      const raw = await fetch(`${t.baseUrl}/f/${body.slug}`);
      expect(raw.headers.get('content-disposition')).toBe(
        `inline; filename="_____ _1_.txt"; filename*=UTF-8''%D0%BA%D0%BE%D1%82%D0%B8%D0%BA%20%221%22.txt`,
      );
    });

    it('returns metadata for GET /api/files/:slug', async () => {
      const up = await uploadOk(pngBytes(), 'meta.png');
      const res = await fetch(`${t.baseUrl}/api/files/${up.slug}`);
      expect(res.status).toBe(200);
      const meta = (await res.json()) as FileMeta;
      const { deleteToken: _token, ...expected } = up;
      expect(meta).toEqual(expected);
    });

    it('answers 404 for an unknown slug on every route', async () => {
      expect((await fetch(`${t.baseUrl}/api/files/Zzzzzzzz`)).status).toBe(404);
      expect((await fetch(`${t.baseUrl}/f/Zzzzzzzz.png`)).status).toBe(404);
      expect((await fetch(`${t.baseUrl}/f/not-a-slug`)).status).toBe(404);
      const del = await fetch(`${t.baseUrl}/api/files/Zzzzzzzz`, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': 'x' },
      });
      expect(del.status).toBe(404);
    });

    it('DELETE: wrong token → 403 and the file still downloads; right token → 204, then 404', async () => {
      const up = await uploadOk(pngBytes(), 'keep.png');
      const url = `${t.baseUrl}/api/files/${up.slug}`;

      const wrong = await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': 'nope' },
      });
      expect(wrong.status).toBe(403);
      const missing = await fetch(url, { method: 'DELETE' });
      expect(missing.status).toBe(403);
      expect((await fetch(`${t.baseUrl}/f/${up.slug}.png`)).status).toBe(200);

      const right = await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': up.deleteToken },
      });
      expect(right.status).toBe(204);
      expect((await fetch(url)).status).toBe(404);
      expect((await fetch(`${t.baseUrl}/f/${up.slug}.png`)).status).toBe(404);
      expect(await t.storedEntries()).toEqual([]);
    });

    it('authorization: the delete token of file A does not delete file B (403)', async () => {
      const a = await uploadOk(pngBytes(), 'a.png');
      const b = await uploadOk(pngBytes(), 'b.png');

      const res = await fetch(`${t.baseUrl}/api/files/${b.slug}`, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': a.deleteToken },
      });
      expect(res.status).toBe(403);
      expect((await fetch(`${t.baseUrl}/f/${b.slug}.png`)).status).toBe(200);
      expect(t.repository.rows.has(b.slug)).toBe(true);
    });

    it('serves Range: bytes=0-99 as 206 with 100 bytes', async () => {
      const bytes = pngBytes(4096);
      const up = await uploadOk(bytes, 'range.png');

      const res = await fetch(`${t.baseUrl}/f/${up.slug}`, {
        headers: { Range: 'bytes=0-99' },
      });
      expect(res.status).toBe(206);
      expect(res.headers.get('content-range')).toBe('bytes 0-99/4096');
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.length).toBe(100);
      expect(body.equals(bytes.subarray(0, 100))).toBe(true);
      expect(res.headers.get('content-security-policy')).toBe(CSP);
    });

    it('answers HEAD with headers and no body', async () => {
      const up = await uploadOk(pngBytes(2048), 'head.png');
      const res = await fetch(`${t.baseUrl}/f/${up.slug}.png`, {
        method: 'HEAD',
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-length')).toBe('2048');
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('accept-ranges')).toBe('bytes');
      expect((await res.arrayBuffer()).byteLength).toBe(0);
    });

    it('after expiresAt (fake timers) answers 410, and one cleanup run removes the row and the file', async () => {
      const up = await uploadOk(pngBytes(), 'soon.png');
      const filePath = join(t.uploadDir, up.slug);
      expect(await readFile(filePath)).toBeDefined();

      // Only Date is faked: the HTTP stack keeps its real timers.
      jest.useFakeTimers({
        doNotFake: [
          'hrtime',
          'nextTick',
          'performance',
          'queueMicrotask',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'requestIdleCallback',
          'cancelIdleCallback',
          'setImmediate',
          'clearImmediate',
          'setInterval',
          'clearInterval',
          'setTimeout',
          'clearTimeout',
        ],
      });
      jest.setSystemTime(Date.parse(up.expiresAt) + 1);

      expect((await fetch(`${t.baseUrl}/f/${up.slug}.png`)).status).toBe(410);
      expect((await fetch(`${t.baseUrl}/api/files/${up.slug}`)).status).toBe(
        410,
      );
      const del = await fetch(`${t.baseUrl}/api/files/${up.slug}`, {
        method: 'DELETE',
        headers: { 'X-Delete-Token': up.deleteToken },
      });
      expect(del.status).toBe(410);

      const removed = await t.app.get(FilesCleanupService).runCleanup();
      expect(removed).toBe(1);
      expect(t.repository.rows.size).toBe(0);
      expect(await t.storedEntries()).toEqual([]);
      expect((await fetch(`${t.baseUrl}/f/${up.slug}.png`)).status).toBe(404);
    });
  });

  describe('with MAX_TOTAL_BYTES = 1 MB', () => {
    beforeEach(async () => {
      t = await createFilesTestApp({ config: { maxTotalBytes: 1024 * 1024 } });
    });

    it('answers 507 for a 200 KB upload when 900 KB are already stored', async () => {
      await uploadOk(new Uint8Array(900 * 1024), 'first.bin');

      const res = await upload(new Uint8Array(200 * 1024), 'second.bin');
      expect(res.status).toBe(507);
      expect(await res.json()).toEqual({
        statusCode: 507,
        error: 'Insufficient Storage',
        reason: 'quota_exceeded',
      });
      expect(t.repository.rows.size).toBe(1);
      expect(await t.tmpEntries()).toEqual([]);
      expect(await t.storedEntries()).toHaveLength(1);
    });

    it('does not count expired files towards the quota', async () => {
      const first = await uploadOk(new Uint8Array(900 * 1024), 'first.bin');
      const row = t.repository.rows.get(first.slug);
      if (row) row.expiresAt = new Date(Date.now() - 1);

      await uploadOk(new Uint8Array(200 * 1024), 'second.bin');
    });
  });

  describe('boot', () => {
    it('sweeps orphaned files and stale tmp files, keeping files that have a row', async () => {
      t = await createFilesTestApp({
        beforeInit: async ({ uploadDir, repository }) => {
          await mkdir(join(uploadDir, '.tmp'), { recursive: true });
          await writeFile(join(uploadDir, 'Orphan01'), 'x');
          await writeFile(join(uploadDir, 'Kept0001'), 'y');
          await writeFile(join(uploadDir, '.tmp', 'stale'), 'z');
          await writeFile(join(uploadDir, 'README.txt'), 'not ours');
          await repository.create({
            slug: 'Kept0001',
            originalName: 'kept.txt',
            ext: 'txt',
            mime: 'text/plain',
            size: 1,
            source: 'UPLOAD',
            sourceUrl: null,
            deleteTokenHash: '0'.repeat(64),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3_600_000),
          });
        },
      });

      expect((await t.storedEntries()).sort()).toEqual([
        'Kept0001',
        'README.txt',
      ]);
      expect(await t.tmpEntries()).toEqual([]);
    });
  });
});
