# FilesDrop

## Requirements

- [Bun](https://bun.sh) 1.4.0+
- Node.js 24+
- Docker (for PostgreSQL)

## Getting started

```bash
bun install
bun run db:setup     # PostgreSQL on :6543, migrations, seed
bun run start:dev    # api → http://localhost:7347  ·  web → http://localhost:4747
```

Health check: `curl http://localhost:7347/health`

## Workspaces

| Path | Package | Stack |
|---|---|---|
| `apps/api` | `@filesdrop/api` | NestJS 11, Prisma 7, PostgreSQL |
| `apps/web` | `@filesdrop/web` | Next.js 16, React 19, Tailwind CSS 4 |
| `packages/shared` | `@filesdrop/shared` | shared TypeScript |

See `CLAUDE.md` for all commands and conventions.
