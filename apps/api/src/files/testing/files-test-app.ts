import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import { FileAccessTokens } from '../file-access';
import { FILES_CONFIG, type FilesConfig } from '../files.config';
import { FilesModule } from '../files.module';
import { FilesRepository } from '../files.repository';
import { MIME_SNIFFER, type MimeSniffer } from '../mime-sniffer';
import {
  DNS_RESOLVER,
  type DnsResolver,
  PINNED_REQUEST,
  type PinnedRequest,
} from '../ssrf/pinned-request';
import { InMemoryFilesRepository } from './in-memory-files.repository';

/** Recognises PNG only — enough for the specs, without loading ESM file-type. */
export const pngOnlySniffer: MimeSniffer = async (head) =>
  Buffer.from(head.subarray(0, 8)).equals(
    Buffer.from('89504e470d0a1a0a', 'hex'),
  )
    ? { ext: 'png', mime: 'image/png' }
    : undefined;

export type FilesTestApp = {
  app: INestApplication;
  baseUrl: string;
  repository: InMemoryFilesRepository;
  uploadDir: string;
  /** Names currently in `${uploadDir}/.tmp`. */
  tmpEntries(): Promise<string[]>;
  /** Slug-named files currently in `uploadDir`. */
  storedEntries(): Promise<string[]>;
  close(): Promise<void>;
};

export type FilesTestAppOptions = {
  config?: Partial<FilesConfig>;
  resolver?: DnsResolver;
  pinnedRequest?: PinnedRequest;
  /** Runs before the app boots (e.g. to seed files for the orphan sweep). */
  beforeInit?: (ctx: {
    uploadDir: string;
    repository: InMemoryFilesRepository;
  }) => Promise<void>;
};

/**
 * AppModule minus the database and the cron module (`@nestjs/schedule` is
 * ESM-only and Jest cannot load it; see files-cron.module.ts).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    FilesModule,
  ],
})
class FilesTestRootModule {}

const unexpected = (what: string) => (): never => {
  throw new Error(`unexpected ${what} in this spec`);
};

/**
 * Boots FilesModule on an ephemeral port with a temp UPLOAD_DIR, an
 * in-memory repository, and the same global setup as `main.ts`.
 */
export const createFilesTestApp = async (
  options: FilesTestAppOptions = {},
): Promise<FilesTestApp> => {
  const uploadDir = await mkdtemp(join(tmpdir(), 'filesdrop-spec-'));
  const repository = new InMemoryFilesRepository();
  const config: FilesConfig = {
    uploadDir,
    maxTotalBytes: 10 * 1024 * 1024 * 1024,
    rateLimit: 1000,
    rateWindowMs: 600_000,
    trustCfHeader: false,
    fetchTimeoutMs: 30_000,
    maxRedirects: 3,
    ...options.config,
  };
  await options.beforeInit?.({ uploadDir, repository });

  const moduleRef = await Test.createTestingModule({
    imports: [FilesTestRootModule],
  })
    .overrideProvider(FilesRepository)
    .useValue(repository)
    .overrideProvider(FILES_CONFIG)
    .useValue(config)
    .overrideProvider(MIME_SNIFFER)
    .useValue(pngOnlySniffer)
    .overrideProvider(DNS_RESOLVER)
    .useValue(options.resolver ?? unexpected('DNS lookup'))
    .overrideProvider(PINNED_REQUEST)
    .useValue(options.pinnedRequest ?? unexpected('outbound request'))
    .overrideProvider(FileAccessTokens)
    .useValue(new FileAccessTokens(TEST_ACCESS_SECRET))
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;

  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    repository,
    uploadDir,
    tmpEntries: () => readdir(join(uploadDir, '.tmp')),
    storedEntries: async () =>
      (await readdir(uploadDir)).filter((name) => name !== '.tmp'),
    close: async () => {
      await app.close();
      await rm(uploadDir, { recursive: true, force: true });
    },
  };
};

/** The access-token secret the specs' app signs with. */
export const TEST_ACCESS_SECRET = Buffer.from('spec-secret-'.repeat(4), 'utf8');

/** A 1 KB PNG-signed buffer. */
export const pngBytes = (size = 1024): Buffer => {
  const bytes = Buffer.alloc(size, 0x2a);
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(bytes);
  return bytes;
};

export const uploadForm = (
  bytes: Uint8Array,
  name: string,
  ttl?: string,
  password?: string,
): FormData => {
  const form = new FormData();
  if (ttl !== undefined) form.append('ttl', ttl);
  if (password !== undefined) form.append('password', password);
  form.append('file', new Blob([bytes]), name);
  return form;
};
