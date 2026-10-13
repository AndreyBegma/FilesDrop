# Deploying FilesDrop

Production runs on the same host as the Woodpecker agent, as one compose
project (`filesdrop`) of four containers on one network (`filesdrop`), reached
only through the Cloudflare tunnel `filesdrop`. Nothing publishes a host port.

| Service / container | Image | Listens | Public hostname |
|---|---|---|---|
| `filesdrop-web` | `filesdrop-web:production` (apps/web/Dockerfile) | 4747 | `filesdrop.luna-realm.com` |
| `filesdrop-api` | `filesdrop-api:production` (apps/api/Dockerfile) | 7347 | `filesdrop-api.luna-realm.com` |
| `filesdrop-postgres` | `postgres:16.5-alpine` | 5432, network only | — |
| `filesdrop-cloudflared` | `cloudflare/cloudflared:latest` | — | — |

The tunnel routes themselves (`hostname → http://filesdrop-web:4747`,
`→ http://filesdrop-api:7347`) live in the Cloudflare dashboard, not here.

## How a release reaches production

1. A pull request into `develop` or `main` runs `install`, `check`, `test` and
   `build` in `.woodpecker/pipeline.yml`. Nothing is built into an image and
   nothing is deployed.
2. The merge into `develop` runs the same checks again.
3. The release pull request `develop → main` runs the checks; its merge (a push
   to `main`) additionally runs:
   - `build-images` → `deploy/build.sh`: builds both images on this host and
     tags them `:production`;
   - `deploy` → `deploy/refresh.sh`: syncs the compose file and operator
     scripts into the stack directory, tags what is running as `:previous`,
     runs `docker compose -p filesdrop up -d --wait`, and then requires a 2xx
     from `https://filesdrop.luna-realm.com/` and
     `https://filesdrop-api.luna-realm.com/health`.

The api container runs `prisma migrate deploy` before it starts serving, so a
release's migrations are applied by the deploy itself.

## The stack directory

`/home/archi/stacks/filesdrop` — **never in git**, never synced back. The
`deploy` step mounts it at the same path the host uses.

```
/home/archi/stacks/filesdrop/
  .env                 TUNNEL_TOKEN, POSTGRES_PASSWORD   (yours; mode 600)
  docker-compose.yml   copied from docker/docker-compose.prod.yml on every deploy
  rollback.sh          copied from deploy/stack/ on every deploy
  status.sh            copied from deploy/stack/ on every deploy
  uploads/             the uploaded files (the `filesdrop-uploads` volume binds here)
```

The database lives in the docker volume `filesdrop-postgres-data`, not in this
directory.

Edit only `.env`. Everything else in the list except `uploads/` is overwritten
by the next deploy.

## First-time setup

1. **Stop the dev database on this host, or rename its project.**
   `docker/docker-compose.yml` is also compose project `filesdrop` with a
   container called `filesdrop-postgres`. `refresh.sh` refuses to deploy while
   that container exists, rather than fight it for the name.
   `bun run db:down` stops it (its volume is kept).
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

   Skipping this step is also fine: the first deploy creates the directory and
   an empty `.env`, then stops with a list of what to fill in.
4. Merge `develop → main`, or re-run the latest `main` pipeline.

## Day to day

```sh
sh /home/archi/stacks/filesdrop/status.sh        # containers, image ages, which .env keys are set
docker logs -f filesdrop-api                      # or -web, -postgres, -cloudflared
```

Never pass `-v` to `docker compose down` here unless you mean to delete the
database.

## Rolling back

Every deploy tags the images that were running just before it as
`filesdrop-api:previous` and `filesdrop-web:previous`.

```sh
sh /home/archi/stacks/filesdrop/rollback.sh
```

retags `:previous` as `:production` and recreates the api and web containers.
Postgres, the uploads and the tunnel are left alone.

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

## Building or checking by hand

```sh
docker compose -f docker/docker-compose.prod.yml config   # validate the stack file
sh deploy/build.sh                                         # build both :production images
```
