# Deploy no Railway (produção de teste)

Um único serviço: Express serve `/api` + SPA React (`dist`) na mesma URL.

> **Segredos:** valores reais para colar no Railway estão em [`docs/railway-variables.env`](railway-variables.env) (ficheiro local, no `.gitignore`). Não envies esse ficheiro ao GitHub.

## Resumo do teu ambiente atual

| Item | Valor / estado |
|------|----------------|
| Banco | **Supabase** PostgreSQL (`cibzqalnxezwlzafjdow`, `aws-1-us-west-2`) |
| `DATABASE_URL` | Pooler Supabase, porta **6543**, `?pgbouncer=true` |
| `DIRECT_URL` | Mesmo host, porta **5432** (migrations) |
| `JWT_SECRET` (local) | `dev-jwt-secret-change-in-production` → **gera outro** antes de abrir ao público |
| Google OAuth | **Vazio** no `server/.env` — login Google no `/cliente` só funciona depois de criar Client ID |
| `VITE_API_URL` | Não usar — em produção o front chama `/api` na mesma origem |
| Build / Start | `railway.toml`: `npm ci && npm run build` → `npm run start:prod` |

**Não precisas** de Postgres no Railway se continuares no Supabase (recomendado: já tens dados e migrations lá).

---

## 1. Criar o projeto

1. [Railway](https://railway.com) → **New Project** → **Deploy from GitHub repo** (repositório Sloot).
2. O Railway usa automaticamente:
   - **Build:** `npm run build:railway` (evita erro `EBUSY` do `npm ci` no cache do Nixpacks)
   - **Start:** `npm run start:prod` (`prisma migrate deploy` + `node server/index.js`)

---

## 2. Variáveis no Railway (copiar)

Serviço da **app** → **Variables** → **Raw Editor** → cola o conteúdo de `docs/railway-variables.env`.

Ou define manualmente (mesmos valores que `server/.env`):

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.cibzqalnxezwlzafjdow:***@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.cibzqalnxezwlzafjdow:***@aws-1-us-west-2.pooler.supabase.com:5432/postgres
JWT_SECRET=dev-jwt-secret-change-in-production
GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_ID=
```

(URL completa com password está em `docs/railway-variables.env`.)

| Variável | Notas |
|----------|--------|
| `NODE_ENV` | `production` — ativa servir `dist/` e `trust proxy` |
| `DATABASE_URL` | Igual ao teu `server/.env` (pooler 6543) |
| `DIRECT_URL` | Igual ao teu `server/.env` (5432) — **não** uses a mesma URL que no Railway Postgres |
| `JWT_SECRET` | Para teste podes usar o de cima; para produção: `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` | Backend — vazio até criares credencial Web no Google Cloud |
| `VITE_GOOGLE_CLIENT_ID` | **Mesmo** valor que `GOOGLE_CLIENT_ID`; obrigatório no **build** |
| `PORT` | Deixa o Railway definir — não copies `3001` do local |

Depois de mudar `VITE_*`, faz **Redeploy** (variáveis Vite entram só no build).

### Alternativa: Postgres só no Railway

Se quiseres base nova no Railway:

1. **+ New** → **PostgreSQL**
2. `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
3. `DIRECT_URL` = **igual** a `DATABASE_URL`
4. Remove as URLs Supabase acima

---

## 3. Domínio

1. Serviço → **Settings** → **Networking** → **Generate Domain**
2. Exemplo: `https://sloot-production.up.railway.app` (o teu será outro slug)

### Google Cloud (quando tiveres Client ID)

Credencial **OAuth 2.0 – Web**:

- **Authorized JavaScript origins:** `https://TEU-DOMINIO.up.railway.app`
- Coloca o mesmo ID em `GOOGLE_CLIENT_ID` e `VITE_GOOGLE_CLIENT_ID` e redeploy

Enquanto `GOOGLE_CLIENT_ID` estiver vazio, o agendamento público pode usar registo/login por email; o botão Google mostra erro de configuração.

---

## 4. Primeiro deploy

1. Push para o GitHub ou **Deploy** manual.
2. Logs devem mostrar: `Sloot — produção — porta …` e migrations OK.
3. Banco Supabase **já com dados** do dev: **não** corras `npm run db:seed` (apaga tudo).

Se o Supabase estiver vazio e quiseres dados de exemplo **uma vez**:

```bash
npm run db:seed
```

| Utilizador | Senha | Papel |
|------------|-------|--------|
| `admin@admin.com` | `admin` | Gerente |
| `carlos@barberpro.com` | `123` | Barbeiro |
| `andre@barberpro.com` | `123` | Barbeiro |
| `rafael@barberpro.com` | `123` | Barbeiro |

---

## 5. Verificar

Substitui `TEU-DOMINIO` pelo domínio gerado no Railway:

- `https://TEU-DOMINIO/health` → `{ "status": "ok", ... }`
- `https://TEU-DOMINIO/` → login staff
- `https://TEU-DOMINIO/cliente` → agendamento público

Link de divulgação (na app): `https://TEU-DOMINIO/cliente`

---

## 6. CLI (opcional)

```bash
npm i -g @railway/cli
railway login
railway link
railway variables set NODE_ENV=production
# … ou importa docs/railway-variables.env via dashboard
railway up
```

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Build `EBUSY` em `node_modules/.cache` | Usar `npm run build:railway` (já em `railway.toml`); ou variável `NIXPACKS_NO_CACHE=1` + redeploy |
| Build falha Prisma | `DATABASE_URL` / `DIRECT_URL` no serviço antes do deploy |
| Migration falha Supabase | Confirma `DIRECT_URL` na porta **5432**, não 6543 |
| 502 / healthcheck | Deploy Logs; `JWT_SECRET` definido |
| Login Google | Preenche `VITE_GOOGLE_CLIENT_ID` + origem no Google + redeploy |
| EPERM `prisma generate` (Windows) | Para o servidor local antes de `prisma generate` |

## Ficheiros do projeto

- `railway.toml` — build, start, healthcheck `/health`
- `nixpacks.toml` — Node 20, `NODE_ENV=production`
- `docs/railway-variables.env` — bloco pronto para colar (local, ignorado pelo git)
- `package.json` → `start:prod`, `db:seed`
