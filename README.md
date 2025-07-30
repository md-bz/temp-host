# Temp Host

A self-hosted temporary file sharing service with **authentication**, **CAPTCHA verification**, and **rate limiting**. Built with **Hono** and powered by **Bun** runtime for speed.

---

## Features

-   **Temporary File Hosting** – Files auto-expire after a configured time or download limit.
-   **Authentication (JWT)** – Secure upload and access.
-   **CAPTCHA Support** – Prevents robot login/signup (Redis-backed).
-   **Rate Limiting** – Redis-backed throttling for abuse prevention.
-   **SQLite / libSQL** – Lightweight, serverless-ready DB via Drizzle ORM.
-   **Automatic Cleanup** – Cron-based deletion of expired files.

## Tech Stack

-   **Runtime**: [Bun](https://bun.sh)
-   **Framework**: [Hono](https://hono.dev)
-   **Database**: SQLite (default) or any libSQL-compatible DB
-   **JSX**:for frontend
-   **Rate Limit / CAPTCHA Store**: Redis
-   **Auth**: JWT
-   **ORM**: Drizzle
-   **CAPTCHA**: [captcha-canvas](https://www.npmjs.com/package/captcha-canvas) + [@napi-rs/canvas](https://www.npmjs.com/package/@napi-rs/canvas)

## Requirements

-   [Bun](https://bun.sh)
-   Redis or preferably valkey (required for CAPTCHA and rate limiting)
-   SQLite or alternative libSQL database

## Installation

```bash
git clone https://github.com/md-bz/temp-host.git
cd temp-host
bun install

cp .env.example .env
```

## Environment Variables

make sure to edit .env to config your setting

## Development

```bash
bun dev
```

---

## Build & Run (Production)

```bash
bun build src/index.tsx --compile --outfile temp-host
./temp-host
```

## Usage

1. **Authentication**

    - JWT required unless `SKIP_AUTH=true`.
    - Obtain token via `/auth/login` endpoint.

1. **File Upload**

    - `POST /upload` with `Authorization: Bearer <token>` and CAPTCHA validation.
    - Returns a shareable download URL.

1. **File Download**

    - Access provided URL until TTL or max download count is reached.

---

## Cleanup

-   Expired files and metadata are automatically removed via cron jobs.

## LICENSE

GPL3
