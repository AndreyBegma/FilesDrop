import {
  DEFAULT_TTL,
  type FileMeta,
  MAX_FILE_BYTES,
  type Ttl,
  ttlToMs,
  type UploadResult,
} from '@filesdrop/shared';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { apiError } from './api-error';
import {
  extOf,
  hasExecutableMagic,
  isDeniedExtension,
  isInlineMime,
  mimeFromExt,
  sanitizeName,
} from './file-policy';
import { FileStorageService, type StagedFile } from './file-storage.service';
import { FILES_CONFIG, type FilesConfig } from './files.config';
import {
  type FileRow,
  FileSource,
  FilesRepository,
  SlugTakenError,
} from './files.repository';
import { MIME_SNIFFER, type MimeSniffer } from './mime-sniffer';
import {
  deleteTokenMatches,
  generateDeleteToken,
  generateSlug,
  hashDeleteToken,
  SLUG_PATTERN,
} from './secrets';
import { UrlFetcher } from './ssrf/url-fetcher.service';

type IngestInput = {
  staged: StagedFile;
  name: string;
  source: FileSource;
  sourceUrl: string | null;
  ttl: Ttl;
};

const SLUG_ATTEMPTS = 5;
const CLEANUP_BATCH = 500;

const toMeta = (row: FileRow): FileMeta => ({
  slug: row.slug,
  name: row.originalName,
  ext: row.ext,
  mime: row.mime,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  inline: isInlineMime(row.mime),
});

/** Last path segment of a URL, as a file name. */
const nameFromUrl = (url: URL): string => {
  const segment = url.pathname.split('/').pop() ?? '';
  try {
    return decodeURIComponent(segment) || 'download';
  } catch {
    return segment || 'download';
  }
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  /** Serialises quota check + insert so concurrent uploads cannot overshoot. */
  private commitQueue: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(FILES_CONFIG) private readonly config: FilesConfig,
    private readonly repository: FilesRepository,
    private readonly storage: FileStorageService,
    private readonly urlFetcher: UrlFetcher,
    @Inject(MIME_SNIFFER) private readonly sniff: MimeSniffer,
  ) {}

  /** A multipart upload already staged in `.tmp` by the multer engine. */
  uploadStaged(
    staged: StagedFile,
    originalName: string,
    ttl: Ttl = DEFAULT_TTL,
  ): Promise<UploadResult> {
    return this.ingest({
      staged,
      name: originalName,
      source: FileSource.UPLOAD,
      sourceUrl: null,
      ttl,
    });
  }

  async uploadFromUrl(
    rawUrl: string,
    ttl: Ttl = DEFAULT_TTL,
  ): Promise<UploadResult> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.fetchTimeoutMs,
    );
    let staged: StagedFile;
    let finalUrl: URL;
    try {
      const resource = await this.urlFetcher.open(rawUrl, controller.signal);
      finalUrl = resource.url;
      if (
        resource.contentLength !== null &&
        resource.contentLength > MAX_FILE_BYTES
      ) {
        resource.body.destroy();
        throw apiError(413, 'too_large');
      }
      // The stager aborts past MAX_FILE_BYTES whatever Content-Length said.
      staged = await this.storage.stage(
        resource.body,
        this.storage.newTmpPath(),
        controller.signal,
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        (error.getStatus() === 413 || !controller.signal.aborted)
      ) {
        throw error;
      }
      if (controller.signal.aborted) throw apiError(408, 'timeout');
      // The remote reset or broke the body mid-stream.
      throw apiError(422, 'fetch_failed');
    } finally {
      clearTimeout(timer);
    }
    return this.ingest({
      staged,
      name: nameFromUrl(finalUrl),
      source: FileSource.URL,
      sourceUrl: rawUrl,
      ttl,
    });
  }

  async getMeta(slug: string): Promise<FileMeta> {
    return toMeta(await this.findLive(slug));
  }

  /** The row and on-disk path for `/f/`, or 404 / 410. */
  async resolveDownload(slug: string): Promise<{ row: FileRow; path: string }> {
    const row = await this.findLive(slug);
    return { row, path: this.storage.pathFor(row.slug) };
  }

  async delete(slug: string, token: string | undefined): Promise<void> {
    const row = await this.findLive(slug);
    if (!token || !deleteTokenMatches(token, row.deleteTokenHash)) {
      throw apiError(403, 'wrong_token');
    }
    await this.repository.deleteBySlug(row.slug);
    await this.storage.remove(row.slug);
  }

  /** Deletes expired rows and their files. Returns how many were removed. */
  async cleanupExpired(now: Date = new Date()): Promise<number> {
    let removed = 0;
    for (;;) {
      const slugs = await this.repository.findExpiredSlugs(now, CLEANUP_BATCH);
      if (slugs.length === 0) break;
      await this.repository.deleteBySlugs(slugs);
      await Promise.all(slugs.map((slug) => this.storage.remove(slug)));
      removed += slugs.length;
      if (slugs.length < CLEANUP_BATCH) break;
    }
    return removed;
  }

  /** Removes files on disk that have no row, and every leftover tmp file. */
  async sweepOrphans(): Promise<number> {
    await this.storage.clearTmp();
    const onDisk = await this.storage.listStoredSlugs();
    let removed = 0;
    for (let i = 0; i < onDisk.length; i += CLEANUP_BATCH) {
      const chunk = onDisk.slice(i, i + CLEANUP_BATCH);
      const known = await this.repository.existingSlugs(chunk);
      const orphans = chunk.filter((slug) => !known.has(slug));
      await Promise.all(orphans.map((slug) => this.storage.remove(slug)));
      removed += orphans.length;
    }
    return removed;
  }

  private async findLive(slug: string): Promise<FileRow> {
    if (!SLUG_PATTERN.test(slug)) throw apiError(404, 'not_found');
    const row = await this.repository.findBySlug(slug);
    if (!row) throw apiError(404, 'not_found');
    if (row.expiresAt.getTime() <= Date.now()) throw apiError(410, 'expired');
    return row;
  }

  private async ingest(input: IngestInput): Promise<UploadResult> {
    const { staged } = input;
    try {
      if (staged.size > MAX_FILE_BYTES) throw apiError(413, 'too_large');
      const name = sanitizeName(input.name);
      const nameExt = extOf(name);
      if (isDeniedExtension(nameExt)) throw apiError(415, 'denied_extension');

      const head = await this.storage.readHead(staged.tmpPath);
      if (hasExecutableMagic(head)) throw apiError(415, 'executable_content');
      const sniffed = await this.sniff(head).catch(() => undefined);
      if (sniffed && isDeniedExtension(sniffed.ext)) {
        throw apiError(415, 'executable_content');
      }

      const ext = nameExt || (sniffed ? extOf(`x.${sniffed.ext}`) : '');
      const mime = sniffed?.mime ?? mimeFromExt(ext);
      const deleteToken = generateDeleteToken();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + ttlToMs(input.ttl));

      const row = await this.serialised(async () => {
        const used = await this.repository.sumActiveSize(createdAt);
        if (used + staged.size > this.config.maxTotalBytes) {
          throw apiError(507, 'quota_exceeded');
        }
        const created = await this.insertWithFreshSlug({
          originalName: name,
          ext,
          mime,
          size: staged.size,
          source: input.source,
          sourceUrl: input.sourceUrl,
          deleteTokenHash: hashDeleteToken(deleteToken),
          createdAt,
          expiresAt,
        });
        try {
          await this.storage.commit(staged.tmpPath, created.slug);
        } catch (error) {
          await this.repository.deleteBySlug(created.slug);
          throw error;
        }
        return created;
      });

      this.logger.log(
        `Stored ${row.slug} (${row.size} B, ${row.mime}, ${input.source})`,
      );
      return { ...toMeta(row), deleteToken };
    } finally {
      await this.storage.discard(staged.tmpPath);
    }
  }

  private async insertWithFreshSlug(
    data: Omit<Parameters<FilesRepository['create']>[0], 'slug'>,
  ): Promise<FileRow> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.create({ ...data, slug: generateSlug() });
      } catch (error) {
        if (!(error instanceof SlugTakenError) || attempt >= SLUG_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private serialised<T>(task: () => Promise<T>): Promise<T> {
    const run = this.commitQueue.then(task, task);
    this.commitQueue = run.catch(() => undefined);
    return run;
  }
}
