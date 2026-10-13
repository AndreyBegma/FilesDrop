import { Injectable, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesModule } from './files.module';
import { FilesCleanupService } from './files-cleanup.service';

/**
 * Kept apart from FilesModule because `@nestjs/schedule` 12 ships ESM only:
 * Node 24 loads it via `require(esm)`, but Jest (no `--experimental-vm-modules`)
 * cannot, so the specs boot FilesModule without this module.
 */
@Injectable()
export class FilesCleanupCron {
  constructor(private readonly cleanup: FilesCleanupService) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'files-cleanup' })
  tick(): Promise<number> {
    return this.cleanup.runCleanup();
  }
}

@Module({
  imports: [FilesModule],
  providers: [FilesCleanupCron],
})
export class FilesCronModule {}
