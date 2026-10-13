import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';
import { FileStorageService } from './file-storage.service';

/**
 * Pipes (e.g. a bad `ttl`) run after multer has staged the file. If anything
 * after staging fails, remove the tmp file before the error goes out.
 */
@Injectable()
export class StagedUploadCleanupInterceptor implements NestInterceptor {
  constructor(private readonly storage: FileStorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      catchError((error: unknown) => {
        const path = req.file?.path;
        const cleanup = path ? this.storage.discard(path) : Promise.resolve();
        return from(cleanup).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }
}
