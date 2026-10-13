import { PASSWORD_MAX, PASSWORD_MIN, TTLS, type Ttl } from '@filesdrop/shared';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

/** Multipart fields next to `file`. */
export class UploadFileDto {
  @IsOptional()
  @IsIn(TTLS)
  ttl?: Ttl;

  /** Locks the file: `/f/` then needs a token from `unlock`. */
  @IsOptional()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password?: string;
}

export class UploadFromUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsIn(TTLS)
  ttl?: Ttl;

  @IsOptional()
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password?: string;
}

export class UnlockDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
