/**
 * The bot's handlers against a REAL FilesDrop API, with Telegram mocked.
 * Run by hand, never in CI:
 *
 *   # an API from this checkout with BOT_API_KEY=test and RATE_LIMIT=3, e.g.
 *   #   cd apps/api && BOT_API_KEY=test RATE_LIMIT=3 PORT=7398 node dist/src/main
 *   API_INTERNAL_URL=http://127.0.0.1:7398 BOT_API_KEY=test \
 *     bun apps/bot/scripts/integration.ts
 *
 * What it proves:
 *   1. a file sent to the bot ends up on the API, with working links;
 *   2. the lifetime button re-uploads with the new TTL and deletes the old file;
 *   3. Delete removes the file;
 *   4. uploads carrying the bot headers are rate-limited per Telegram user
 *      (`tg:<id>`), not per IP: user A runs out, user B and a plain IP client
 *      do not; a wrong key falls back to the IP.
 */
import { rm } from 'node:fs/promises';
import { createFilesApi } from '../src/api-client';
import { createHandlers } from '../src/handlers';
import {
  baseDeps,
  fakeContext,
  fakeTelegram,
  fakeVolume,
} from '../src/testing/fakes';

const api = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:7398').replace(
  /\/+$/,
  '',
);
const key = process.env.BOT_API_KEY ?? 'test';
const limit = Number(process.env.RATE_LIMIT ?? 3);

let failed = 0;
const check = (what: string, ok: boolean, detail = '') => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`,
  );
  if (!ok) failed++;
};

const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  Buffer.alloc(256, 0x2a),
]);

const volume = await fakeVolume();
const files = createFilesApi({ baseUrl: api, botApiKey: key });
const tg = fakeTelegram({
  F1: await volume.put('file_0.png', PNG),
});
const handlers = createHandlers(
  baseDeps({
    telegram: tg.api,
    files,
    tgFilesDir: volume.dir,
    publicWebUrl: api,
  }),
);

const slugOf = (text: string | undefined) =>
  /\/v\/([A-Za-z0-9]+)/.exec(text ?? '')?.[1];

// 1. upload through the handler
const userA = 900_000_001;
const upload = fakeContext({
  userId: userA,
  chatId: 1,
  message: {
    document: {
      file_id: 'F1',
      file_unique_id: 'u1',
      file_size: PNG.length,
      file_name: 'cat.png',
    },
  },
});
await handlers.file(upload.ctx);
const first = tg.edits.at(-1);
const slug1 = slugOf(first?.text);
check(
  'upload reply has a preview link',
  Boolean(slug1),
  first?.text.split('\n')[2],
);
const meta1 = await fetch(`${api}/api/files/${slug1}`);
check(
  'the API knows the file',
  meta1.status === 200,
  `GET meta ${meta1.status}`,
);
const raw1 = await fetch(`${api}/f/${slug1}.png`);
check(
  'the direct link serves the bytes',
  raw1.status === 200 && (await raw1.arrayBuffer()).byteLength === PNG.length,
  `GET /f ${raw1.status}`,
);

// 2. lifetime button: 24h → 1h
const press = fakeContext({
  userId: userA,
  chatId: 1,
  callback: { data: 'fd1:t:1h', messageId: first?.messageId ?? 0 },
});
await handlers.callback(press.ctx);
const slug2 = slugOf(tg.edits.at(-1)?.text);
check('lifetime change gives a new slug', Boolean(slug2) && slug2 !== slug1);
const meta2 = (await (await fetch(`${api}/api/files/${slug2}`)).json()) as {
  expiresAt: string;
};
const hoursLeft = (Date.parse(meta2.expiresAt) - Date.now()) / 3_600_000;
check(
  'the new file lives about 1h',
  hoursLeft > 0.9 && hoursLeft <= 1,
  `${hoursLeft.toFixed(2)}h`,
);
const old = await fetch(`${api}/api/files/${slug1}`);
check(
  'the old file is gone',
  old.status === 404 || old.status === 410,
  `${old.status}`,
);

// 3. Delete
const del = fakeContext({
  userId: userA,
  chatId: 1,
  callback: { data: 'fd1:d', messageId: first?.messageId ?? 0 },
});
await handlers.callback(del.ctx);
const gone = await fetch(`${api}/api/files/${slug2}`);
check(
  'Delete removes the file',
  gone.status === 404 || gone.status === 410,
  `${gone.status}`,
);

// 4. tg:<id> rate limit. User A has used 2 uploads (the first and the 1h one).
const raw = (headers: Record<string, string>) => {
  const form = new FormData();
  form.append('ttl', '1h');
  form.append('file', new Blob([PNG]), 'probe.png');
  return fetch(`${api}/api/files`, { method: 'POST', headers, body: form });
};
const statuses: number[] = [];
for (let i = 0; i < limit; i++) {
  statuses.push(
    (await raw({ 'X-Bot-Key': key, 'X-Bot-User': String(userA) })).status,
  );
}
check(
  `user A gets 429 after ${limit} uploads`,
  statuses.filter((s) => s === 201).length === limit - 2 &&
    statuses.at(-1) === 429,
  statuses.join(','),
);
const userB = await raw({ 'X-Bot-Key': key, 'X-Bot-User': '900000002' });
check(
  'user B (same IP) still uploads: the tracker is tg:<id>',
  userB.status === 201,
  `${userB.status}`,
);
const plainIp = await raw({});
check(
  'a plain IP client is not affected by tg users',
  plainIp.status === 201,
  `${plainIp.status}`,
);
const wrongKey: number[] = [];
for (let i = 0; i < limit; i++) {
  wrongKey.push(
    (await raw({ 'X-Bot-Key': 'wrong', 'X-Bot-User': String(900_000_100 + i) }))
      .status,
  );
}
check(
  'a wrong key counts against the IP, ignoring X-Bot-User',
  wrongKey.includes(429),
  wrongKey.join(','),
);

await rm(volume.dir, { recursive: true, force: true });
console.log(
  failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`,
);
process.exit(failed === 0 ? 0 : 1);
