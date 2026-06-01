# Deploy Runbook — second-brain-backend on Cloudflare Workers

## Prerequisites

- Node.js 20+, npm
- Cloudflare account (free tier is sufficient)
- Wrangler authenticated: `npx wrangler login`

---

## 1. First-time secrets setup

Run each command once and paste the value when prompted. These are stored encrypted in Cloudflare and never appear in source code or `wrangler.toml`.

```bash
npx wrangler secret put INTERNAL_API_SECRET
npx wrangler secret put DATABASE_URL
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

`SESSION_TTL_HOURS` is a plain `[vars]` entry in `wrangler.toml` (default: `"2"`). Override it via the Cloudflare dashboard or:

```bash
npx wrangler secret put SESSION_TTL_HOURS   # only needed if you want a non-default value
```

`CORS_ORIGIN` is optional. If set, it controls which frontend origin receives CORS headers.
If absent, all cross-origin requests are blocked at the CORS layer.

```bash
npx wrangler secret put CORS_ORIGIN
# Enter: https://your-frontend.vercel.app
# For multiple origins: https://a.example.com,https://b.example.com
```

---

## 2. Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in real values:

```bash
cp .dev.vars .dev.vars.example   # create example once
# edit .dev.vars with real credentials
npm run dev                       # starts wrangler dev on http://localhost:8787
```

`.dev.vars` is gitignored. Never commit it.

The local dev server supports the full runtime — including `nodejs_compat` — so
`node:crypto` works exactly as it will in production.

### Smoke test (wrangler dev running)

```bash
# Health check
curl -H "x-internal-secret: $SECRET" http://localhost:8787/health

# Session reset
curl -X POST \
  -H "x-internal-secret: $SECRET" \
  -H "x-sb-session-id: test-session" \
  http://localhost:8787/session/reset

# Text document ingest
curl -X POST \
  -H "x-internal-secret: $SECRET" \
  -H "x-sb-session-id: test-session" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Hello world content for testing."}' \
  http://localhost:8787/documents

# PDF upload
curl -X POST \
  -H "x-internal-secret: $SECRET" \
  -H "x-sb-session-id: test-session" \
  -F "file=@/path/to/test.pdf" \
  http://localhost:8787/documents

# Chat (streaming — copy curl output shows SSE chunks)
curl -X POST \
  -H "x-internal-secret: $SECRET" \
  -H "x-sb-session-id: test-session" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"What is in my documents?"}]}]}' \
  http://localhost:8787/chat
```

---

## 3. Deploy

```bash
npm run deploy
# equivalent to: npx wrangler deploy
```

Wrangler bundles `src/index.ts` (via esbuild), uploads the Worker, and prints the live URL:
`https://second-brain-backend.<your-subdomain>.workers.dev`

---

## 4. After deploy — update the frontend

Set the backend URL in your Next.js frontend environment:

```bash
# .env.local (local) or Vercel dashboard (production)
NEXT_PUBLIC_API_URL=https://second-brain-backend.<your-subdomain>.workers.dev
```

---

## 5. Database migrations

Migrations run locally against Neon via `drizzle-kit`. The Worker **never** runs migrations.

```bash
npm run db:generate   # generate SQL from schema changes
npm run db:migrate    # apply to Neon (uses .env DATABASE_URL)
```

---

## 6. Free-tier limits and caveats

| Resource | Free limit | This workload | Risk |
|---|---|---|---|
| Requests/day | 100,000 | Personal use — fine | Low |
| CPU time/request | 10ms (shared CPU, bursty) | Chat stream: minimal CPU after initial dispatch; PDF parse: WASM-heavy | **Medium** — see below |
| Memory | 128 MB | PDF WASM buffer ~15–30 MB per request | Fine |
| Request body size | 100 MB | Max PDF = 10 MB (enforced in app) | Fine |
| Subrequests/request | 1,000 | Neon HTTP (1) + Google AI (1–2) | Fine |
| Duration (streaming) | No hard wall on free; paid cap is 30s | SSE chat: well under 30s for typical queries | Fine |

**PDF + CPU-time note:** `unpdf` uses a WASM build of PDF.js. Cold-start WASM compilation on Workers free tier can spike CPU time for the first request. Mitigations already in place:
- 10 MB PDF size cap enforced before parsing
- 15-second parsing timeout in `extractPdfText`
- 500K character extraction cap

If you hit CPU limit errors (error code 1015), options are:
1. Reduce `MAX_PDF_BYTES` from 10 MB to ~3–5 MB
2. Upgrade to Workers Paid ($5/month) which gives 30ms guaranteed CPU per request (and more burst headroom)

**Neon per-request cost:** The `neon-http` driver opens a fresh HTTPS connection per query. For the free tier this is fine. Neon's free tier allows up to 10 GB storage and 3 GB compute hours/month — more than enough for a portfolio project.

---

## 7. Session isolation note

Session IDs (`x-sb-session-id`) are client-provided strings, not server-issued tokens. All clients sharing the same `INTERNAL_API_SECRET` share the document namespace unless they use distinct session IDs. For a personal portfolio project this is by design — the auth model is "shared secret" not "per-user authentication."

---

## 8. Rollback

Cloudflare keeps the previous version. Roll back via dashboard (Workers > Deployments > Rollback) or:

```bash
npx wrangler rollback
```
