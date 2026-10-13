import type { FileMeta, UploadResult } from '@filesdrop/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { apiError } from './api-error';
import { UploadFileDto, UploadFromUrlDto } from './dto/upload.dto';
import { FilesService } from './files.service';
import { StagedUploadCleanupInterceptor } from './staged-upload-cleanup.interceptor';
import { UploadThrottlerGuard } from './upload-throttler.guard';

@Controller('api/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

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
    );
  }

  @Post('from-url')
  @UseGuards(UploadThrottlerGuard)
  fromUrl(@Body() body: UploadFromUrlDto): Promise<UploadResult> {
    return this.files.uploadFromUrl(body.url, body.ttl);
  }

  @Get(':slug')
  meta(@Param('slug') slug: string): Promise<FileMeta> {
    return this.files.getMeta(slug);
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
