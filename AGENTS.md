# AGENTS.md — temp-host

## Commands

| Command | What it does |
|---|---|
| `bun dev` | Dev server with hot-reload |
| `bun run build` | Build to `./dist` (target bun) |
| `bun run prod` | Run built app from `./dist` |
| `bunx drizzle-kit generate` | Generate SQLite migrations from `src/db/schema.ts` |
| `bunx drizzle-kit migrate` | Apply migrations |

No test, lint, typecheck, or format scripts exist.

## Architecture

- **Runtime**: Bun, **Framework**: Hono with JSX (`hono/jsx`), **DB**: SQLite via Drizzle ORM (turso dialect)
- **Entrypoint**: `src/index.tsx` — mounts `/api` router (JSON), `/auth` router (HTML forms), serves `/file` and `/` HTML pages
- **API router**: `src/api.ts` — `POST /api/file` (auth+rate-limited), `GET /api/file/:id` (public, stream download)
- **Auth**: JWT. Two middleware: `htmlAuth` (reads token from cookie), `jsonAuth` (reads from `Authorization: Bearer`). Set `SKIP_AUTH=true` to disable.
- **Rate limiting**: Redis-backed (`hono-rate-limiter` + `rate-limit-redis`). Skip with `RATE_LIMIT_SKIP=true`. Keyed by JWT `id` (or `"everyone"` if no JWT).
- **CAPTCHA**: Redis-backed, generated with `captcha-canvas` + `@napi-rs/canvas`. Requires fonts on system (`fontconfig` in Docker).
- **Cleanup cron**: `src/cron.ts` — deletes expired/over-downloaded files daily at 5:00 AM.
- **File storage**: `./files/` directory. DB records in SQLite `files` table.

## Environment (`.env`)

Key vars: `DATABASE_URL` (file:./db.sqlite), `JWT_SECRET`, `REDIS_URL`, `SKIP_AUTH`, `MAX_AGE`, `MAX_DOWNLOAD_COUNT`, `MAX_FILE_SIZE` (MB), `RATE_LIMIT_*`

## Docker

`docker compose up` starts valkey + app. Dockerfile installs `fontconfig` for CAPTCHA. Mounts `./sqlite-data`, `./files` as volumes.

## Conventions

- Uses Hono JSX (`react-jsx` transform, `hono/jsx` import source) for server-rendered HTML
- No client-side framework; vanilla JS in `static/`
- Pico CSS (`pico.classless.slate.min.css`) for styling via `static/`
