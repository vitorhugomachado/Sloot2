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
| Build / Start | `Dockerfile` (Node 20 Alpine) → `node server/index.js` (`railway.toml`) |

**Não precisas** de Postgres no Railway se continuares no Supabase (recomendado: já tens dados e migrations lá).

---

## 1. Criar o projeto

1. [Railway](https://railway.com) → **New Project** → **Deploy from GitHub repo** (repositório Sloot).
2. O Railway usa automaticamente (`railway.toml` + `Dockerfile`):
   - **Build:** imagem Docker (Vite + Prisma), sem Nixpacks
   - **Start:** `node server/index.js` (`prisma migrate deploy` no arranque)

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
| `DIRECT_URL` | **Direct connection** do Supabase (`*.connect.supabase.com` ou `db.*.supabase.co`) — **não** `pooler.supabase.com:5432` |
| `JWT_SECRET` | Para teste podes usar o de cima; para produção: `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` | Backend — vazio até criares credencial Web no Google Cloud |
| `VITE_GOOGLE_CLIENT_ID` | **Mesmo** valor que `GOOGLE_CLIENT_ID`; obrigatório no **build** |
| `DEFAULT_TENANT_SLUG` | Slug do tenant principal (ex.: `two-brothers` ou `lanotic`) — redirects `/cliente` e `/barbeiros` |
| `VITE_DEFAULT_TENANT_SLUG` | (Opcional) Mesmo slug no build do frontend; fallback `two-brothers` |
| `PORT` | **Nunca definir** (ex.: `3001`) — o proxy do Railway falha o healthcheck |

Depois de mudar `VITE_*`, faz **Redeploy** (variáveis Vite entram só no build).

### Postgres: usar Supabase (recomendado)

Cola o bloco de **`docs/railway-variables.env`** (ficheiro local, gitignore).  
**Não** uses `${{Postgres.DATABASE_URL}}` — o banco de produção fica no Supabase.

Migração experimental para Postgres no Railway: **[MIGRATE-POSTGRES-RAILWAY.md](./MIGRATE-POSTGRES-RAILWAY.md)** (opcional).

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
2. Logs devem mostrar: `Aplicando migrations Prisma`, depois `Sloot — produção — porta …`.
3. Banco Supabase **já com dados** do dev: **não** corras `npm run db:seed` (apaga tudo).
4. **Admin `/admin`:** após migrations, cria o utilizador (uma vez), local ou Railway shell:
   `cd server && npm run create:platform-admin -- seu@email.com SuaSenha`

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
- `https://TEU-DOMINIO/SEU-SLUG/barbeiros/login` → login staff (visual unificado)
- `https://TEU-DOMINIO/admin` → admin plataforma
- `https://TEU-DOMINIO/SEU-SLUG/cliente` → agendamento público

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
| Build Nix `No space left on device` / `nix-env` falha | O projeto usa **Dockerfile** (não Nixpacks). Faz push de `main`, **Clear build cache** no serviço Railway → **Redeploy** |
| App em commit antigo após push | Deploy novo falhou — Railway mantém a última build **com sucesso**. Abre **Deployments** → último deploy (se **Failed**, lê Build/Deploy logs). Confirma repo **vitorhugomachado/Sloot2**, branch **main**, builder **Dockerfile**. Abre `https://TEU-DOMINIO/health` e compara `gitSha` com o commit no GitHub (`b9431d5…`). **Clear build cache** → **Redeploy** |
| `npm run start:prod` / `ENOENT package.json` no start | O `startCommand` deve ser `node server/index.js` (`railway.toml`); a imagem Docker não copia `package.json` da raiz |
| Build `EBUSY` em `node_modules/.cache` | Com Dockerfile isto deixa de aplicar; se voltares a Nixpacks: `npm run build:railway` ou `NIXPACKS_NO_CACHE=1` |
| Build `Could not find Prisma Schema` no `postinstall` | Dockerfile usa `npm ci --ignore-scripts` e `prisma generate` só depois de `COPY . .` — faz pull de `main` e redeploy |
| Build falha Prisma | `DATABASE_URL` / `DIRECT_URL` no serviço antes do deploy |
| `P1001` / migrate no build | Migrations correm no **start**, não no build; corrige `DIRECT_URL` (URI Direct no Supabase) |
| Migration falha Supabase | `DIRECT_URL` = Connection string **Direct** (não pooler `:5432`) |
| Healthcheck failure | Apaga `PORT=3001`; confirma `DATABASE_URL` + `JWT_SECRET`; migrations correm no **start** (`server/index.js`) |
| `/admin` erro 500 no login | Tabela `PlatformAdmin` — confirma migration `20260520130000_platform_admin` e corre `npm run create:platform-admin` |
| `relation "Tenant" does not exist` | `DIRECT_URL` incorreto ou migrations não aplicadas — vê logs do start |
| `BusinessInfo` does not exist (P2021) | Migration já removeu a tabela, mas o **container ainda corre código antigo** — faz **Redeploy** do commit `main` mais recente; nos logs do start deve aparecer `API multi-tenant (Tenant, sem BusinessInfo)` |
| 502 / healthcheck | Deploy Logs; `JWT_SECRET` definido |
| Login Google | Preenche `VITE_GOOGLE_CLIENT_ID` + origem no Google + redeploy |
| EPERM `prisma generate` (Windows) | Para o servidor local antes de `prisma generate` |

## Ficheiros do projeto

- `railway.toml` — Dockerfile build, start, healthcheck `/health`
- `Dockerfile` — build Node 20 Alpine (sem Nix)
- `nixpacks.toml` — legado; ignorado quando `builder = "DOCKERFILE"`
- `docs/railway-variables.env` — bloco pronto para colar (local, ignorado pelo git)
- `package.json` → `start:prod`, `db:seed`
