# Deploying FilesDrop

Production runs on the same host as the Woodpecker agent, as one compose
project (`filesdrop`) of four containers on one network (`filesdrop`), reached
only through the Cloudflare tunnel `filesdrop`, plus two optional ones for the
Telegram bot (compose profile `bot`). Nothing publishes a host port.

| Service / container | Image | Listens | Public hostname |
|---|---|---|---|
| `filesdrop-web` | `filesdrop-web:production` (apps/web/Dockerfile) | 4747 | `filesdrop.luna-realm.com` |
| `filesdrop-api` | `filesdrop-api:production` (apps/api/Dockerfile) | 7347 | `filesdrop-api.luna-realm.com` |
| `filesdrop-postgres` | `postgres:16.5-alpine` | 5432, network only | — |
| `filesdrop-cloudflared` | `cloudflare/cloudflared:latest` | — | — |
| `filesdrop-tg-api` (profile `bot`) | `aiogram/telegram-bot-api:10.2` | 8081, network only | — |
| `filesdrop-bot` (profile `bot`) | `filesdrop-bot:production` (apps/bot/Dockerfile) | — | [@catfilesdrop_bot](https://t.me/catfilesdrop_bot) |

The tunnel routes themselves (`hostname → http://filesdrop-web:4747`,
`→ http://filesdrop-api:7347`) live in the Cloudflare dashboard, not here.

## How a release reaches production

1. A pull request into `develop` or `main` runs `install`, `check`, `test` and
   `build` in `.woodpecker/pipeline.yml`. Nothing is built into an image and
   nothing is deployed.
2. The merge into `develop` runs the same checks again.
3. The release pull request `develop → main` runs the checks; its merge (a push
   to `main`) additionally runs:
   - `build-images` → `deploy/build.sh`: builds the api, web and bot images on
     this host and tags them `:production`;
   - `deploy` → `deploy/refresh.sh`: syncs the compose file and operator
     scripts into the stack directory, tags what is running as `:previous`,
     runs `docker compose -p filesdrop up -d --wait`, and then requires a 2xx
     from `https://filesdrop.luna-realm.com/` and
     `https://filesdrop-api.luna-realm.com/health`. After that, if the bot's
     secrets are all set, it starts the bot (see [Telegram bot](#telegram-bot)).

The api container runs `prisma migrate deploy` before it starts serving, so a
release's migrations are applied by the deploy itself.

## The stack directory

`/home/archi/stacks/filesdrop` — **never in git**, never synced back. The
`deploy` step mounts it at the same path the host uses.

```
/home/archi/stacks/filesdrop/
  .env                 TUNNEL_TOKEN, POSTGRES_PASSWORD, FILE_ACCESS_SECRET,
                       and for the bot TELEGRAM_BOT_TOKEN, TELEGRAM_API_ID,
                       TELEGRAM_API_HASH, BOT_API_KEY      (yours; mode 600)
  docker-compose.yml   copied from docker/docker-compose.prod.yml on every deploy
  rollback.sh          copied from deploy/stack/ on every deploy
  status.sh            copied from deploy/stack/ on every deploy
  uploads/             the uploaded files (the `filesdrop-uploads` volume binds here)
```

The database lives in the docker volume `filesdrop-postgres-data`, not in this
directory; the local Bot API server's state and downloads in
`filesdrop-tg-api-data`.

Edit only `.env`. Everything else in the list except `uploads/` is overwritten
by the next deploy.

## First-time setup

1. **Nothing else may own the stack's container names.** The dev database
   (`docker/docker-compose.yml`) is compose project `filesdrop-dev`, container
   `filesdrop-dev-postgres`, bound to `127.0.0.1:6543`, so it runs beside the
   stack. `refresh.sh` still refuses to deploy if any other project holds
   `filesdrop-postgres`, `filesdrop-api`, `filesdrop-web`,
   `filesdrop-cloudflared`, `filesdrop-tg-api` or `filesdrop-bot`.
2. **Activate the repository in Woodpecker** and mark it **trusted** (the
   `build-images` and `deploy` steps mount host volumes, which Woodpecker allows
   only for trusted repositories).
3. **Create the `.env`:**

   ```sh
   mkdir -p /home/archi/stacks/filesdrop
   cp docker/stack.env.example /home/archi/stacks/filesdrop/.env
   chmod 600 /home/archi/stacks/filesdrop/.env
   $EDITOR /home/archi/stacks/filesdrop/.env
   ```

   - The tunnel token: Cloudflare Zero Trust → Networks → Tunnels →
     `filesdrop` → Configure; the value after `--token` in the install command.
   - The database password: `openssl rand -hex 32`. It goes into
     `DATABASE_URL` unescaped, so keep it URL-safe. If you leave it empty,
     the first deploy generates one (only while no database volume exists).

   - `FILE_ACCESS_SECRET` (signs unlock tokens of password-locked files):
     `openssl rand -hex 32`. Left empty, the deploy generates one.
   - The Telegram bot's four values are optional; see
     [Telegram bot](#telegram-bot).

   Skipping this step is also fine: the first deploy creates the directory and
   an empty `.env`, then stops with a list of what to fill in.
4. Merge `develop → main`, or re-run the latest `main` pipeline.

## Day to day

```sh
sh /home/archi/stacks/filesdrop/status.sh        # containers, image ages, which .env keys are set
docker logs -f filesdrop-api                      # or -web, -postgres, -cloudflared, -bot, -tg-api
```

Never pass `-v` to `docker compose down` here unless you mean to delete the
database.

## Rolling back

Every deploy tags the images that were running just before it as
`filesdrop-api:previous`, `filesdrop-web:previous` and, when the bot runs,
`filesdrop-bot:previous`.

```sh
sh /home/archi/stacks/filesdrop/rollback.sh
```

retags `:previous` as `:production` and recreates the api and web containers,
and the bot's when it runs and has a `:previous`. Postgres, the uploads, the
tunnel and the local Bot API server are left alone.

What it does **not** do:

- **Undo migrations.** Prisma has no down migrations. If the bad release added
  one, the old api runs against the new schema; check
  `apps/api/prisma/migrations` in the bad commit before relying on a rollback.
- **Go back more than one release.** The next deploy overwrites `:previous`.
- **Stick.** The next push to `main` deploys `main` again. The lasting fix is a
  revert through `develop → main`; the rollback buys the time to make it.

To go back further, check out the commit you want on this host and run
`sh deploy/build.sh && sh deploy/refresh.sh` from that checkout (refresh.sh
only checks the branch when `CI_COMMIT_BRANCH` is set, i.e. inside CI).

## Telegram bot

[@catfilesdrop_bot](https://t.me/catfilesdrop_bot) (apps/bot) takes a file in a
Telegram chat, uploads it to the api over the `filesdrop` network and replies
with the direct and preview links, plus buttons for the lifetime and Delete.
It long-polls a **local Telegram Bot API server** (`filesdrop-tg-api`,
`--local` mode), which is what lets files up to 95 MB through (the cloud Bot
API stops at 20 MB). There is no webhook and nothing public.

### Turning it on

All four values go into `/home/archi/stacks/filesdrop/.env`:

| Key | Where it comes from |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` (or `/token` for the existing bot) |
| `TELEGRAM_API_ID` | <https://my.telegram.org> → API development tools → create an app once (any name) → `App api_id` |
| `TELEGRAM_API_HASH` | the same page → `App api_hash` |
| `BOT_API_KEY` | `openssl rand -hex 32`; the api and the bot share it |

Then merge `develop → main` or re-run the latest `main` pipeline.

### How the deploy treats it

- The two services are in the compose profile **`bot`**, so a plain `up`
  never starts them.
- `refresh.sh` starts the bot only when **all four** values are set. If any is
  empty it says `telegram bot: off (empty: …)`, deploys the site as usual, and
  stops and removes a bot that is still running from an earlier deploy.
- The site comes up and passes its smoke check **first**, without the bot.
  Only then are `filesdrop-tg-api` and `filesdrop-bot` started. If they do not
  come up, the deploy prints a WARNING with their last logs and still
  succeeds: the bot never holds the site back. Both have
  `restart: unless-stopped`, and the bot waits for the local server by itself.
- The smoke check stays on the two public hostnames.

### The one-time logOut

Telegram requires a bot to call `logOut` on the cloud Bot API once before a
local server may serve it; after that, the bot cannot return to the cloud for
10 minutes. The bot does this itself, **once**: at start, if the marker file
`.filesdrop-cloud-logout` is missing from the `filesdrop-tg-api-data` volume,
it calls `logOut` on api.telegram.org and writes the marker as soon as
Telegram answers (with whatever answer, so a crash loop cannot repeat it). If
Telegram could not be reached at all, there is no marker and the next start
tries again. To force another attempt:

```sh
docker run --rm -v filesdrop-tg-api-data:/d alpine rm /d/.filesdrop-cloud-logout
docker restart filesdrop-bot
```

Because of the logOut, never point anything at api.telegram.org with this
bot's token afterwards: that would move it back to the cloud.

### Bot profile (commands and descriptions)

Set by hand, once, and again when the texts in `apps/bot/src/profile.json`
change. It goes through the local server, inside the running container:

```sh
docker exec filesdrop-bot bun dist/scripts/set-profile.js
```

### Files on disk

The local server downloads every file into the `filesdrop-tg-api-data`
volume. The bot runs as that server's uid (101) so it can read them and delete
them: when a reply's buttons expire (30 minutes), on Delete, and in a sweep
of anything older than two hours.

## Building or checking by hand

```sh
docker compose -f docker/docker-compose.prod.yml config               # validate the stack file
docker compose -f docker/docker-compose.prod.yml --profile bot config # …with the bot
sh deploy/build.sh                                                     # build all :production images
```
