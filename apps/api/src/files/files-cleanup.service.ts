import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { FilesService } from './files.service';

/**
 * Decision 6: orphan sweep + expiry at boot. The 10-minute schedule lives in
 * `FilesCronModule`, which drives `runCleanup`.
 */
@Injectable()
export class FilesCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FilesCleanupService.name);
  private running = false;

  constructor(private readonly files: FilesService) {}

  async onApplicationBootstrap(): Promise<void> {
    const orphans = await this.files.sweepOrphans();
    if (orphans > 0) this.logger.log(`Removed ${orphans} orphaned file(s)`);
    await this.runCleanup();
  }

  /** Deletes expired rows and files; overlapping runs are skipped. */
  async runCleanup(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const removed = await this.files.cleanupExpired();
      if (removed > 0) this.logger.log(`Removed ${removed} expired file(s)`);
      return removed;
    } catch (error) {
      this.logger.error('Expiry cleanup failed', (error as Error).stack);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
