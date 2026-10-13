import { Injectable } from '@nestjs/common';
import { type File as FileRow, FileSource, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type { FileRow };
export { FileSource };

export type NewFileRow = {
  slug: string;
  originalName: string;
  ext: string;
  mime: string;
  size: number;
  source: FileSource;
  sourceUrl: string | null;
  deleteTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

/** Thrown by `create` when the slug is already taken. */
export class SlugTakenError extends Error {}

/** Persistence port of the files module; the only place that touches Prisma. */
export abstract class FilesRepository {
  abstract create(data: NewFileRow): Promise<FileRow>;
  abstract findBySlug(slug: string): Promise<FileRow | null>;
  /** Returns whether a row was deleted. */
  abstract deleteBySlug(slug: string): Promise<boolean>;
  /** Sum of `size` over rows with `expiresAt > now`. */
  abstract sumActiveSize(now: Date): Promise<number>;
  /** Up to `limit` slugs with `expiresAt <= now`. */
  abstract findExpiredSlugs(now: Date, limit: number): Promise<string[]>;
  abstract deleteBySlugs(slugs: string[]): Promise<number>;
  /** The subset of `slugs` that have a row. */
  abstract existingSlugs(slugs: string[]): Promise<Set<string>>;
}

@Injectable()
export class PrismaFilesRepository extends FilesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: NewFileRow): Promise<FileRow> {
    try {
      return await this.prisma.file.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new SlugTakenError(data.slug);
      }
      throw error;
    }
  }

  findBySlug(slug: string): Promise<FileRow | null> {
    return this.prisma.file.findUnique({ where: { slug } });
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    const { count } = await this.prisma.file.deleteMany({ where: { slug } });
    return count > 0;
  }

  async sumActiveSize(now: Date): Promise<number> {
    const result = await this.prisma.file.aggregate({
      _sum: { size: true },
      where: { expiresAt: { gt: now } },
    });
    return result._sum.size ?? 0;
  }

  async findExpiredSlugs(now: Date, limit: number): Promise<string[]> {
    const rows = await this.prisma.file.findMany({
      select: { slug: true },
      where: { expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.slug);
  }

  async deleteBySlugs(slugs: string[]): Promise<number> {
    if (slugs.length === 0) return 0;
    const { count } = await this.prisma.file.deleteMany({
      where: { slug: { in: slugs } },
    });
    return count;
  }

  async existingSlugs(slugs: string[]): Promise<Set<string>> {
    if (slugs.length === 0) return new Set();
    const rows = await this.prisma.file.findMany({
      select: { slug: true },
      where: { slug: { in: slugs } },
    });
    return new Set(rows.map((row) => row.slug));
  }
}
