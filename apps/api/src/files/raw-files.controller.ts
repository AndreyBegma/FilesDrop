import { basename, dirname } from 'node:path';
import type { ApiError } from '@filesdrop/shared';
import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  contentDisposition,
  isInlineMime,
  RAW_SECURITY_HEADERS,
} from './file-policy';
import { FilesService } from './files.service';

type SendError = Error & {
  status?: number;
  statusCode?: number;
  headers?: Record<string, string>;
};

/**
 * Raw bytes: `GET /f/:slug` and `GET /f/:slug.:ext` (the extension is
 * cosmetic). `send` provides Range (206/416), HEAD and conditional GETs.
 */
@Controller('f')
export class RawFilesController {
  constructor(private readonly files: FilesService) {}

  @Get(':file')
  async download(
    @Param('file') file: string,
    @Res() res: Response,
    @Query('k') queryToken: unknown,
    @Headers('x-file-access') headerToken: string | undefined,
  ): Promise<void> {
    const slug = file.split('.')[0];
    const token =
      headerToken || (typeof queryToken === 'string' ? queryToken : undefined);
    const { row, path } = await this.files.resolveDownload(slug, token);
    const inline = isInlineMime(row.mime);
    const locked = row.passwordHash !== null;

    res.setHeader('Content-Type', row.mime);
    res.setHeader(
      'Content-Disposition',
      contentDisposition(row.originalName, inline),
    );
    // An unlocked copy must not sit in a shared cache keyed without the token.
    res.setHeader(
      'Cache-Control',
      locked ? 'private, no-store' : 'public, max-age=300',
    );
    if (locked) res.setHeader('Referrer-Policy', 'no-referrer');
    for (const [name, value] of Object.entries(RAW_SECURITY_HEADERS)) {
      res.setHeader(name, value);
    }

    // `root` keeps send's dotfile check off UPLOAD_DIR itself (e.g. ./.uploads).
    res.sendFile(
      basename(path),
      { root: dirname(path), cacheControl: false, dotfiles: 'deny' },
      (error?: SendError) => {
        if (!error || res.headersSent) return;
        const statusCode = error.status ?? error.statusCode ?? 500;
        for (const [name, value] of Object.entries(error.headers ?? {})) {
          res.setHeader(name, value);
        }
        res.removeHeader('Content-Disposition');
        const body: ApiError = {
          statusCode,
          error: statusCode === 404 ? 'Not Found' : error.message,
        };
        res
          .status(statusCode)
          .type('application/json')
          .send(JSON.stringify(body));
      },
    );
  }
}
