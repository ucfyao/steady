# Deployment

Steady runs as two Vercel projects built from this repository, with a Supabase project used only as PostgreSQL. Local development (`pnpm bootstrap`, `pnpm dev`) is in the README and does not use any of this.

```
browser ──> web project (apps/web, static)
              │ /api/* rewrite
              v
            API project (apps/api, one serverless function)
              │ transaction pooler, port 6543
              v
            Supabase PostgreSQL
```

The browser only ever calls `/api` on the web origin, so there is no CORS and the client code is the same as in development. The code is the same in both environments; only the environment variables differ.

| File                         | Purpose                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/web/vercel.json`       | Forwards `/api/*` to the API project; serves `index.html` for every other path               |
| `apps/api/vercel.json`       | Builds the API with `tsc` and sends every `/api/*` request to `api/index.js`                 |
| `apps/api/api/index.js`      | The Vercel function; re-exports `dist/serverless.js`                                         |
| `apps/api/src/serverless.ts` | Builds the Nest app on the first request and reuses it; trusts the proxy's `X-Forwarded-For` |

## First-time setup

Do the steps in this order: each one needs something from the one before.

### 1. Supabase

1. Create a project. Region: the one closest to your players (e.g. Sydney, `ap-southeast-2`). Save the database password; Supabase does not show it again. A password of letters and digits avoids URL-encoding it.
2. Under **Connect**, copy two connection strings and put the password in:
   - **Session pooler** (port 5432): for migrations
   - **Transaction pooler** (port 6543): for the API
3. Create the tables:

   ```bash
   DATABASE_URL='<session pooler URL>?sslmode=no-verify' pnpm --filter @steady/api db:migrate
   ```

   `sslmode=no-verify` encrypts without checking the certificate chain: `pg` treats `sslmode=require` as `verify-full`, which fails on Supabase's own CA.

### 2. API project

Import the repository in Vercel with:

| Setting          | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| Project name     | `steady-api` (the web project's rewrite points to `steady-api.vercel.app`) |
| Root directory   | `apps/api`                                                                 |
| Framework preset | Other (build and output come from `vercel.json`)                           |
| Node.js version  | 24.x (Settings → Build and Deployment)                                     |
| Function region  | Same region as the database (Settings → Functions)                         |

Environment variables, for the **Production** environment only (see [Preview deployments](#preview-deployments)):

| Variable       | Value                                            |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | Transaction pooler URL with `?sslmode=no-verify` |
| `DB_POOL_MAX`  | `2` (each function instance has its own pool)    |
| `NODE_ENV`     | `production`                                     |

Redeploy after changing settings. Check: `https://steady-api.vercel.app/api/health` returns `{"status":"ok"}`.

### 3. Web project

Import the same repository again with root directory `apps/web`, framework preset Vite and Node.js 24.x. It needs no environment variables. If the API project has a different name, change the URL in `apps/web/vercel.json` first.

Check: open the site and play a full session through to results and progress.

## Releasing

There is no deploy workflow to run. CI and CD are already connected:

- **CI:** `.github/workflows/ci.yml` runs `pnpm check` and the end-to-end tests on every pull request.
- **CD:** Vercel deploys every push to `main` to production and builds a preview for every pull request.

Vercel does not wait for CI. Production only gets tested code because `main` is protected: make the CI jobs required status checks in the branch protection rules.

### Database migrations

Migrations are not run automatically. A pull request that adds a migration (a new file in `apps/api/drizzle/`) needs one manual step:

1. Run `db:migrate` against Supabase (session pooler URL, as in setup step 1) **before** merging.
2. Merge. Vercel deploys the new code.

Between those two steps the old code runs against the new schema, so a migration must not break the code that is live: add columns and tables, and remove old ones in a later release.

### Preview deployments

Previews use production data:

- A web preview forwards `/api` to `steady-api.vercel.app`, the production API.
- An API preview has no `DATABASE_URL` if the variable is set for Production only, so it fails to start instead of writing to the production database.

Treat anything done in a preview as real data.

## Limits on serverless

- **Rate limits are approximate.** The rate limiter counts in memory, so each function instance keeps its own count.
- **Cold starts.** The first request to a new instance builds the Nest app and opens a connection; it is slower than the rest.
- **Free Supabase projects pause** after a week without activity. Restore the project from the Supabase dashboard.

## Troubleshooting

| Symptom                                                   | Likely cause                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/api/health` returns 500, logs say `Invalid environment` | `DATABASE_URL` missing or not a `postgres://` URL                           |
| `self-signed certificate in certificate chain`            | `?sslmode=no-verify` missing from `DATABASE_URL`                            |
| `password authentication failed`                          | Wrong password, or special characters not URL-encoded                       |
| `/api/health` returns 503                                 | The database is unreachable or the Supabase project is paused               |
| The site loads but every API call is 404                  | Wrong API URL in `apps/web/vercel.json`, or the API project is not deployed |
| Errors about missing tables or columns                    | Migrations not run (see [Database migrations](#database-migrations))        |
| All players hit the rate limit together                   | The client address is not reaching the API in `X-Forwarded-For`             |

Function logs are under **Logs** in each Vercel project.
