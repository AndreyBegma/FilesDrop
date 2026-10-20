import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStorageService } from './file-storage.service';
import { FilesService } from './files.service';
import {
  createFilesTestApp,
  type FilesTestApp,
} from './testing/files-test-app';

describe('expired file cleanup retries', () => {
  let t: FilesTestApp;
  const now = new Date('2026-01-01T00:00:00Z');
  const slug = 'Expired1';

  beforeEach(async () => {
    t = await createFilesTestApp();
    await t.repository.create({
      slug,
      originalName: 'expired.txt',
      ext: 'txt',
      mime: 'text/plain',
      size: 7,
      source: 'UPLOAD',
      sourceUrl: null,
      deleteTokenHash: '0'.repeat(64),
      createdAt: new Date(now.getTime() - 3_600_000),
      expiresAt: new Date(now.getTime() - 1),
    });
    await writeFile(join(t.uploadDir, slug), 'expired');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await t?.close();
  });

  it('keeps the expired row after an unlink failure so the next pass retries it', async () => {
    const failure = Object.assign(new Error('temporary unlink failure'), {
      code: 'EIO',
    });
    const remove = jest
      .spyOn(t.app.get(FileStorageService), 'remove')
      .mockRejectedValueOnce(failure);
    const service = t.app.get(FilesService);

    await expect(service.cleanupExpired(now)).rejects.toBe(failure);
    expect(t.repository.rows.has(slug)).toBe(true);
    expect(await readFile(join(t.uploadDir, slug), 'utf8')).toBe('expired');

    await expect(service.cleanupExpired(now)).resolves.toBe(1);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(t.repository.rows.size).toBe(0);
    expect(await t.storedEntries()).toEqual([]);
  });

  it('retries safely when the file was removed but deleting its row failed', async () => {
    const failure = new Error('temporary database failure');
    jest.spyOn(t.repository, 'deleteBySlugs').mockRejectedValueOnce(failure);
    const service = t.app.get(FilesService);

    await expect(service.cleanupExpired(now)).rejects.toBe(failure);
    expect(t.repository.rows.has(slug)).toBe(true);
    expect(await t.storedEntries()).toEqual([]);

    await expect(service.cleanupExpired(now)).resolves.toBe(1);
    expect(t.repository.rows.size).toBe(0);
    expect(await t.storedEntries()).toEqual([]);
  });

  it('allows later batches to advance despite one persistent unlink failure', async () => {
    for (let index = 0; index < 500; index++) {
      const nextSlug = `E${String(index).padStart(7, '0')}`;
      await t.repository.create({
        ...t.repository.rows.get(slug)!,
        slug: nextSlug,
      });
      await writeFile(join(t.uploadDir, nextSlug), 'expired');
    }
    const failure = Object.assign(new Error('persistent unlink failure'), {
      code: 'EACCES',
    });
    const storage = t.app.get(FileStorageService);
    const originalRemove = storage.remove.bind(storage);
    const remove = jest.spyOn(storage, 'remove').mockImplementation((key) => {
      if (key === slug) return Promise.reject(failure);
      return originalRemove(key);
    });
    const service = t.app.get(FilesService);

    await expect(service.cleanupExpired(now)).rejects.toBe(failure);
    expect(t.repository.rows.has(slug)).toBe(true);
    expect(t.repository.rows.size).toBe(2);

    await expect(service.cleanupExpired(now)).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledWith('E0000499');
    expect([...t.repository.rows.keys()]).toEqual([slug]);
    expect(await t.storedEntries()).toEqual([slug]);
  });
});
