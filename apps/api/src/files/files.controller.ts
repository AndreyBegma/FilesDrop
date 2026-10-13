import type { FileLookup, UnlockResult, UploadResult } from '@filesdrop/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { apiError } from './api-error';
import { UnlockDto, UploadFileDto, UploadFromUrlDto } from './dto/upload.dto';
import { FILES_CONFIG, type FilesConfig } from './files.config';
import { FilesService } from './files.service';
import { StagedUploadCleanupInterceptor } from './staged-upload-cleanup.interceptor';
import { clientIp, UploadThrottlerGuard } from './upload-throttler.guard';

@Controller('api/files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    @Inject(FILES_CONFIG) private readonly config: FilesConfig,
  ) {}

  @Post()
  @UseGuards(UploadThrottlerGuard)
  @UseInterceptors(StagedUploadCleanupInterceptor, FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadFileDto,
  ): Promise<UploadResult> {
    if (!file?.path) throw apiError(400, 'no_file');
    return this.files.uploadStaged(
      { tmpPath: file.path, size: file.size },
      file.originalname,
      body.ttl,
      body.password,
    );
  }

  @Post('from-url')
  @UseGuards(UploadThrottlerGuard)
  fromUrl(@Body() body: UploadFromUrlDto): Promise<UploadResult> {
    return this.files.uploadFromUrl(body.url, body.ttl, body.password);
  }

  /** Full meta; a locked file answers only `{ slug, locked, expiresAt }`. */
  @Get(':slug')
  meta(@Param('slug') slug: string): Promise<FileLookup> {
    return this.files.getMeta(slug);
  }

  @Post(':slug/unlock')
  @HttpCode(200)
  unlock(
    @Param('slug') slug: string,
    @Body() body: UnlockDto,
    @Req() req: Request,
  ): Promise<UnlockResult> {
    return this.files.unlock(
      slug,
      body.password,
      clientIp(req, this.config.trustCfHeader),
    );
  }

  @Delete(':slug')
  @HttpCode(204)
  async remove(
    @Param('slug') slug: string,
    @Headers('x-delete-token') token: string | undefined,
  ): Promise<void> {
    await this.files.delete(slug, token);
  }
}
