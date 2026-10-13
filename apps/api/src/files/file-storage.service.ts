import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { type Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MAX_FILE_BYTES } from '@filesdrop/shared';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { apiError } from './api-error';
import { HEAD_BYTES } from './file-policy';
import { FILES_CONFIG, type FilesConfig } from './files.config';
import { SLUG_PATTERN } from './secrets';

export type StagedFile = {
  /** `${UPLOAD_DIR}/.tmp/<uuid>` */
  tmpPath: string;
  size: number;
};

/** Counts bytes and fails with 413 as soon as the per-file limit is passed. */
class LimitedCounter extends Transform {
  size = 0;

  constructor(private readonly limit: number) {
    super();
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.size += chunk.length;
    if (this.size > this.limit) {
      callback(apiError(413, 'too_large'));
      return;
    }
    callback(null, chunk);
  }
}

/**
 * Owns the bytes on disk: `${UPLOAD_DIR}/<slug>`, staged through
 * `${UPLOAD_DIR}/.tmp/<uuid>` and renamed into place.
 */
@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  readonly tmpDir: string;

  constructor(@Inject(FILES_CONFIG) private readonly config: FilesConfig) {
    this.tmpDir = join(config.uploadDir, '.tmp');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.tmpDir, { recursive: true });
  }

  newTmpPath(): string {
    return join(this.tmpDir, randomUUID());
  }

  pathFor(slug: string): string {
    if (!SLUG_PATTERN.test(slug)) throw new Error(`invalid slug: ${slug}`);
    return join(this.config.uploadDir, slug);
  }

  /**
   * Streams `source` into a fresh tmp file. Past MAX_FILE_BYTES (or on any
   * error or abort) the tmp file is removed and the error rethrown.
   */
  async stage(
    source: Readable,
    tmpPath = this.newTmpPath(),
    signal?: AbortSignal,
  ): Promise<StagedFile> {
    const counter = new LimitedCounter(MAX_FILE_BYTES);
    try {
      const sink = createWriteStream(tmpPath, { flags: 'wx' });
      await (signal
        ? pipeline(source, counter, sink, { signal })
        : pipeline(source, counter, sink));
    } catch (error) {
      source.destroy();
      await this.discard(tmpPath);
      throw error;
    }
    return { tmpPath, size: counter.size };
  }

  /** The first HEAD_BYTES bytes of a file (fewer for small files). */
  async readHead(path: string): Promise<Buffer> {
    const handle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async commit(tmpPath: string, slug: string): Promise<void> {
    await rename(tmpPath, this.pathFor(slug));
  }

  async discard(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  async remove(slug: string): Promise<void> {
    await this.discard(this.pathFor(slug));
  }

  /** Slug-named regular files currently on disk. */
  async listStoredSlugs(): Promise<string[]> {
    const entries = await readdir(this.config.uploadDir, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile() && SLUG_PATTERN.test(entry.name))
      .map((entry) => entry.name);
  }

  /** Boot only: nothing can be mid-upload, so every staged file is garbage. */
  async clearTmp(): Promise<void> {
    const entries = await readdir(this.tmpDir);
    await Promise.all(
      entries.map((name) => this.discard(join(this.tmpDir, name))),
    );
    if (entries.length > 0) {
      this.logger.log(`Removed ${entries.length} stale staged upload(s)`);
    }
  }
}
