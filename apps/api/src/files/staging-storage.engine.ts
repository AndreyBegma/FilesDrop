import { MAX_FILE_BYTES } from '@filesdrop/shared';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import { apiError } from './api-error';
import { extOf, isDeniedExtension, sanitizeName } from './file-policy';
import type { FileStorageService } from './file-storage.service';

/**
 * Multer engine that streams the part into `${UPLOAD_DIR}/.tmp/<uuid>`
 * through the size-limited stager. A denylisted extension is refused before
 * a byte is written; anything that fails leaves no tmp file behind.
 */
export class StagingStorageEngine implements StorageEngine {
  constructor(private readonly storage: FileStorageService) {}

  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (
      error?: Error | null,
      info?: Partial<Express.Multer.File>,
    ) => void,
  ): void {
    if (isDeniedExtension(extOf(sanitizeName(file.originalname)))) {
      file.stream.resume();
      callback(apiError(415, 'denied_extension'));
      return;
    }
    this.storage.stage(file.stream).then(
      ({ tmpPath, size }) => callback(null, { path: tmpPath, size }),
      (error: Error) => callback(error),
    );
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    if (!file.path) {
      callback(null);
      return;
    }
    this.storage.discard(file.path).then(
      () => callback(null),
      (error: Error) => callback(error),
    );
  }
}

export const multerOptions = (
  storage: FileStorageService,
): MulterModuleOptions => ({
  storage: new StagingStorageEngine(storage),
  // One byte of headroom so the stager, not busboy's truncation, reports 413.
  limits: { fileSize: MAX_FILE_BYTES + 1, files: 1, fields: 4, parts: 5 },
  defParamCharset: 'utf8',
});
