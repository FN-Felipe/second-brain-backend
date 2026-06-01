# Second Brain — Backend

API do **Second Brain**, um chatbot com RAG: indexe seus textos e PDFs e converse
com eles, com respostas em streaming e citação da fonte. Responsável por
retrieval, ingestão de documentos, geração com Gemini e persistência.

> Frontend (UI + BFF): [second-brain-frontend](https://github.com/FN-Felipe/second-brain-frontend)

## Papel deste serviço

O backend não é exposto ao navegador. Ele só aceita requisições do
frontend (BFF), validadas pelo header `x-internal-secret` (`INTERNAL_API_SECRET`).
Não há CORS.

```
frontend (Next.js) ──HTTP + x-internal-secret──▶ backend (Hono)
```

### Sessão efêmera (sem login)

A aplicação **não tem autenticação**. Cada carregamento da página inicia uma
**sessão efêmera** — um `sid` aleatório guardado em cookie pelo frontend. Ao
**recarregar**, a sessão anterior e seus documentos são **apagados do banco** e
uma nova começa do zero. Os dados ficam isolados por `sid`, e resíduos de sessões
abandonadas são removidos por TTL no reset (`SESSION_TTL_HOURS`, padrão 2h).

## Stack

Hono · TypeScript estrito · Drizzle ORM · Neon (Postgres + pgvector) · Google Gemini · Cloudflare Workers

## Pré-requisitos

- Node 20+
- Conta no [Neon](https://neon.tech) (Postgres serverless)
- Chave do [Google Gemini](https://aistudio.google.com/apikey) (free tier, sem cartão)

## Como rodar

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL e GOOGLE_GENERATIVE_AI_API_KEY
npm run db:migrate     # cria as tabelas + extensão pgvector
npm run dev
```

O serviço sobe em `http://localhost:4000`. Verifique a conexão com o banco em
`http://localhost:4000/health`.

Em produção, defina o mesmo `INTERNAL_API_SECRET` do frontend. Em
desenvolvimento local pode ficar vazio (a validação é desativada).

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor Hono em watch (wrangler dev) |
| `npm run deploy` | Deploy no Cloudflare Workers (wrangler) |
| `npm run typecheck` | Checagem de tipos (tsc) |
| `npm run test` | Testes unitários (Vitest) |
| `npm run db:generate` | Gera migration a partir do schema |
| `npm run db:migrate` | Aplica migrations no banco |
| `npm run db:studio` | Abre o Drizzle Studio |

## Deploy

Cloudflare Workers via GitHub Actions. Push na `master` dispara o deploy.
Detalhes em [`DEPLOY.md`](./DEPLOY.md).
