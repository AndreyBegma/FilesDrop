import type { UploadResult } from '@filesdrop/shared';

export type UploadOutcome =
  | { ok: true; file: UploadResult }
  | { ok: false; status: number; reason?: string };

export type DeleteOutcome = { ok: true } | { ok: false; status: number };

export type FilesApi = {
  upload(input: {
    path: string;
    name: string;
    ttl: string;
    telegramUserId: number;
  }): Promise<UploadOutcome>;
  remove(slug: string, deleteToken: string): Promise<DeleteOutcome>;
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** `status: 0` stands for "the API did not answer at all". */
const NO_ANSWER = 0;

const reasonOf = async (res: Response): Promise<string | undefined> => {
  try {
    const body = (await res.json()) as { reason?: unknown };
    return typeof body.reason === 'string' ? body.reason : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The FilesDrop API over the internal network. Uploads carry X-Bot-Key and
 * X-Bot-User so the API rate-limits per Telegram user (`tg:<id>`) instead of
 * per IP; the file streams from disk (`Bun.file` is read lazily).
 */
export const createFilesApi = (opts: {
  baseUrl: string;
  botApiKey: string;
  fetch?: Fetch;
}): FilesApi => {
  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init));

  return {
    async upload({ path, name, ttl, telegramUserId }) {
      const form = new FormData();
      form.append('ttl', ttl);
      form.append('file', Bun.file(path), name);
      let res: Response;
      try {
        res = await doFetch(`${opts.baseUrl}/api/files`, {
          method: 'POST',
          headers: {
            'X-Bot-Key': opts.botApiKey,
            'X-Bot-User': String(telegramUserId),
          },
          body: form,
        });
      } catch {
        return { ok: false, status: NO_ANSWER };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, reason: await reasonOf(res) };
      }
      return { ok: true, file: (await res.json()) as UploadResult };
    },

    async remove(slug, deleteToken) {
      try {
        const res = await doFetch(
          `${opts.baseUrl}/api/files/${encodeURIComponent(slug)}`,
          { method: 'DELETE', headers: { 'X-Delete-Token': deleteToken } },
        );
        await res.body?.cancel();
        return res.ok ? { ok: true } : { ok: false, status: res.status };
      } catch {
        return { ok: false, status: NO_ANSWER };
      }
    },
  };
};

export const directUrl = (
  webUrl: string,
  file: Pick<UploadResult, 'slug' | 'ext'>,
): string => `${webUrl}/f/${file.slug}${file.ext ? `.${file.ext}` : ''}`;

export const previewUrl = (
  webUrl: string,
  file: Pick<UploadResult, 'slug'>,
): string => `${webUrl}/v/${file.slug}`;
