import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Logger } from './log';

/**
 * Telegram requires a bot to call `logOut` on the cloud Bot API
 * (api.telegram.org) once before a local Bot API server may serve it. After
 * that the bot cannot go back to the cloud for 10 minutes, so this must happen
 * once, never in a loop.
 *
 * The marker file lives in the local server's data volume, next to the state
 * the logOut is about: if that volume is recreated, the bot logs out once more,
 * which is harmless. The marker is written as soon as Telegram has ANSWERED,
 * whatever it answered, so a crash-looping bot does not call logOut again on
 * every restart. Only a network failure (no answer at all) leaves it unwritten.
 * To force another attempt, delete the marker and restart the bot.
 */
export const CLOUD_LOGOUT_MARKER = '.filesdrop-cloud-logout';

export type CloudLogoutResult =
  | 'already_done'
  | 'logged_out'
  | 'telegram_refused'
  | 'no_answer';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const ensureCloudLogout = async (opts: {
  token: string;
  cloudRoot: string;
  markerDir: string;
  log: Logger;
  fetch?: Fetch;
  now?: () => Date;
}): Promise<CloudLogoutResult> => {
  const marker = join(opts.markerDir, CLOUD_LOGOUT_MARKER);
  if (await exists(marker)) return 'already_done';

  const doFetch: Fetch = opts.fetch ?? ((input, init) => fetch(input, init));
  let status: number;
  let ok = false;
  let description = '';
  try {
    const res = await doFetch(`${opts.cloudRoot}/bot${opts.token}/logOut`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    status = res.status;
    try {
      const body = (await res.json()) as {
        ok?: boolean;
        description?: string;
      };
      ok = body.ok === true;
      description =
        typeof body.description === 'string' ? body.description : '';
    } catch {
      ok = false;
    }
  } catch {
    opts.log('cloud_logout', { result: 'no_answer' });
    return 'no_answer';
  }

  const result: CloudLogoutResult = ok ? 'logged_out' : 'telegram_refused';
  await writeFile(
    marker,
    `${JSON.stringify({
      at: (opts.now?.() ?? new Date()).toISOString(),
      result,
      status,
      // Telegram's own words, e.g. "Logged out"; never contains the token.
      description: description.slice(0, 200),
    })}\n`,
    { mode: 0o600 },
  );
  opts.log('cloud_logout', { result, status });
  return result;
};
