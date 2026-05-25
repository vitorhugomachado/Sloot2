# Deploy na Vercel (frontend + API serverless)

Frontend estático (`dist/`) + API Express em [`api/index.js`](../api/index.js) na mesma origem (`/api`).

## Porque dava 404

A Vercel **não** executa `server/index.js` sozinha. Sem a pasta `api/`, pedidos a `/api/tenant/resolve/...` devolvem 404. O React mostra "Barbearia não encontrada" porque o `fetch` falha.

## 1. Variáveis no projeto Vercel

**Settings → Environment Variables** (Production + Preview). Copiar do `server/.env`:

| Variável | Obrigatória | Notas |
|----------|-------------|--------|
| `DATABASE_URL` | Sim | Pooler Supabase `:6543` + `?pgbouncer=true` |
| `DIRECT_URL` | Sim | Conexão directa `:5432` (migrations no build) |
| `JWT_SECRET` | Sim | Não usar o de dev em produção pública |
| `NODE_ENV` | Sim | `production` |
| `GOOGLE_CLIENT_ID` | Se usar Google login | |
| `VITE_GOOGLE_CLIENT_ID` | Build | Mesmo valor que `GOOGLE_CLIENT_ID` |
| `VITE_SUPABASE_URL` | Reset senha cliente | |
| `VITE_SUPABASE_ANON_KEY` | Reset senha cliente | |
| `DEFAULT_TENANT_SLUG` | Recomendado | ex. `two-brothers` |
| `VITE_DEFAULT_TENANT_SLUG` | Build | Mesmo slug |

**Não** definir `VITE_API_URL` — o front usa `/api` na mesma origem.

**Não** definir `SERVE_SPA` na Vercel (só Railway/Docker).

## 2. Build e migrations

O [`vercel.json`](../vercel.json) corre:

```bash
npm run vercel-build
```

Isto faz só `prisma generate` + `vite build` (sem `migrate deploy` — evita falha P1012 se `DIRECT_URL` não estiver no ambiente de **build**).

**Migrations (uma vez por ambiente), no PC ou CI**, com `server/.env` ou variáveis de produção:

```bash
npm run db:migrate:deploy
```

Requer `DATABASE_URL` e `DIRECT_URL` (Supabase: pooler `6543` + direct `5432`).

## 3. Redeploy

Após alterar variáveis `VITE_*`, faz **Redeploy** (entram só no build).

## 4. Verificar

1. `GET https://TEU-PROJETO.vercel.app/health` → `{ "status": "ok", "dbConfigured": true, "runtime": "vercel" }`
2. `GET https://TEU-PROJETO.vercel.app/api/tenant/resolve/two-brothers` → JSON do tenant (não HTML 404)
3. `https://TEU-PROJETO.vercel.app/two-brothers/cliente` → agendamento sem erro no console

| Sintoma | Causa provável |
|---------|----------------|
| "Barbearia não encontrada" **sem** ponto final | Pedido `/api/...` não chega ao Express (404 da Vercel) — confirma deploy com `api/[...path].js` |
| `dbConfigured: false` em `/health` | Falta `DATABASE_URL` nas env vars **Runtime** da Vercel |
| JSON `Barbearia não encontrada.` **com** ponto | API OK; falta tenant na BD — `npm run db:migrate:deploy` + dados no Supabase |

## 5. Limitações

- **Cold start** na primeira request após idle.
- **Body ~4.5MB** nas funções Vercel — fotos grandes em base64 no painel staff podem falhar (no Railway o limite é 50MB).
- **Railway** continua válido: define `SERVE_SPA=true` no Docker (já no `Dockerfile`) ou mantém deploy monolítico — ver [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md).

## 6. Dev local com Vercel CLI

```bash
npm install
cd server && npm install && cd ..
npx vercel dev
```

Requer `server/.env` com as mesmas variáveis.
