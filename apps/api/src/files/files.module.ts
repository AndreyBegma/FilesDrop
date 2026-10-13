import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { FileAccessTokens, fileAccessSecretFromEnv } from './file-access';
import { FileStorageService } from './file-storage.service';
import {
  FILES_CONFIG,
  type FilesConfig,
  filesConfigFromEnv,
} from './files.config';
import { FilesController } from './files.controller';
import { FilesRepository, PrismaFilesRepository } from './files.repository';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';
import { fileTypeSniffer, MIME_SNIFFER } from './mime-sniffer';
import { RawFilesController } from './raw-files.controller';
import {
  DNS_RESOLVER,
  PINNED_REQUEST,
  systemDnsResolver,
  undiciPinnedRequest,
} from './ssrf/pinned-request';
import { UrlFetcher } from './ssrf/url-fetcher.service';
import { multerOptions } from './staging-storage.engine';
import { UnlockLimiter } from './unlock-limiter';
import { uploadThrottlerOptions } from './upload-throttler.guard';

/** Holds FILES_CONFIG so the async module factories below can inject it. */
@Module({
  providers: [
    {
      provide: FILES_CONFIG,
      inject: [ConfigService],
      useFactory: (env: ConfigService): FilesConfig =>
        filesConfigFromEnv((key) => env.get<string>(key)),
    },
    FileStorageService,
  ],
  exports: [FILES_CONFIG, FileStorageService],
})
export class FilesCoreModule {}

@Module({
  imports: [
    FilesCoreModule,
    ThrottlerModule.forRootAsync({
      imports: [FilesCoreModule],
      inject: [FILES_CONFIG],
      useFactory: uploadThrottlerOptions,
    }),
    MulterModule.registerAsync({
      imports: [FilesCoreModule],
      inject: [FileStorageService],
      useFactory: multerOptions,
    }),
  ],
  controllers: [FilesController, RawFilesController],
  providers: [
    FilesService,
    FilesCleanupService,
    UrlFetcher,
    UnlockLimiter,
    {
      provide: FileAccessTokens,
      inject: [ConfigService],
      useFactory: (env: ConfigService): FileAccessTokens =>
        new FileAccessTokens(
          fileAccessSecretFromEnv(
            (key) => env.get<string>(key),
            (message) => new Logger('FileAccess').warn(message),
          ),
        ),
    },
    { provide: FilesRepository, useClass: PrismaFilesRepository },
    { provide: MIME_SNIFFER, useValue: fileTypeSniffer },
    { provide: DNS_RESOLVER, useValue: systemDnsResolver },
    { provide: PINNED_REQUEST, useValue: undiciPinnedRequest },
  ],
  exports: [FilesCleanupService],
})
export class FilesModule {}
