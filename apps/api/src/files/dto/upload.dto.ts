import { TTLS, type Ttl } from '@filesdrop/shared';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Multipart fields next to `file`. */
export class UploadFileDto {
  @IsOptional()
  @IsIn(TTLS)
  ttl?: Ttl;
}

export class UploadFromUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsIn(TTLS)
  ttl?: Ttl;
}
