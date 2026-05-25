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

## 2. Build

O [`vercel.json`](../vercel.json) corre:

```bash
npm run vercel-build
```

Isto faz `prisma generate`, `prisma migrate deploy` e `vite build`. As migrations precisam de `DATABASE_URL` e `DIRECT_URL` **antes** do deploy.

## 3. Redeploy

Após alterar variáveis `VITE_*`, faz **Redeploy** (entram só no build).

## 4. Verificar

1. `GET https://TEU-PROJETO.vercel.app/health` → `{ "status": "ok", ... }`
2. `GET https://TEU-PROJETO.vercel.app/api/tenant/resolve/two-brothers` → JSON do tenant
3. `https://TEU-PROJETO.vercel.app/two-brothers/cliente` → agendamento sem 404 no console

Se `/api/...` responder 404 JSON `Barbearia não encontrada`, a API funciona mas o slug não existe na BD — confirma dados no Supabase ou corre seed **uma vez** num ambiente seguro.

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
