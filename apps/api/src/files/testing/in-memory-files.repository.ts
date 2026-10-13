import { randomUUID } from 'node:crypto';
import {
  type FileRow,
  FilesRepository,
  type NewFileRow,
  SlugTakenError,
} from '../files.repository';

/** Test double for the Prisma-backed repository; same contract, in memory. */
export class InMemoryFilesRepository extends FilesRepository {
  readonly rows = new Map<string, FileRow>();

  async create(data: NewFileRow): Promise<FileRow> {
    if (this.rows.has(data.slug)) throw new SlugTakenError(data.slug);
    const row: FileRow = {
      id: randomUUID(),
      ...data,
      passwordHash: data.passwordHash ?? null,
    };
    this.rows.set(row.slug, row);
    return { ...row };
  }

  async findBySlug(slug: string): Promise<FileRow | null> {
    const row = this.rows.get(slug);
    return row ? { ...row } : null;
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    return this.rows.delete(slug);
  }

  async sumActiveSize(now: Date): Promise<number> {
    let total = 0;
    for (const row of this.rows.values()) {
      if (row.expiresAt.getTime() > now.getTime()) total += row.size;
    }
    return total;
  }

  async findExpiredSlugs(now: Date, limit: number): Promise<string[]> {
    return [...this.rows.values()]
      .filter((row) => row.expiresAt.getTime() <= now.getTime())
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
      .slice(0, limit)
      .map((row) => row.slug);
  }

  async deleteBySlugs(slugs: string[]): Promise<number> {
    let count = 0;
    for (const slug of slugs) if (this.rows.delete(slug)) count++;
    return count;
  }

  async existingSlugs(slugs: string[]): Promise<Set<string>> {
    return new Set(slugs.filter((slug) => this.rows.has(slug)));
  }
}
