# Sloot2 (BarberPro)

Agendamento multi-tenant — React (Vite) + Express + Prisma.

## Deploy (produção)

**Railway apenas:** app Docker + PostgreSQL no mesmo projeto.

Guia: [docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md)

## Desenvolvimento local

```bash
npm install
cd server && npm install && cp .env.example .env
# Preenche DATABASE_URL / DIRECT_URL (Railway TCP Proxy ou Postgres local)
npm run dev          # frontend :5173
cd server && npm run dev   # API :3001 (proxy /api no Vite)
```

Scripts úteis: `npm run db:migrate:deploy`, `npm run db:railway:setup`, `npm run start:prod`
