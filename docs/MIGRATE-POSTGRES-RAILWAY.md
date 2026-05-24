# Migrar Postgres: Supabase → Railway

Guia para **banco novo no Railway** (estrutura via Prisma + dados de teste opcionais). Não copia dados do Supabase — adequado quando os dados atuais são fictícios.

O **Supabase Auth** (recuperação de senha) continua no projeto Supabase; só o **Postgres** da app muda de host.

---

## Checklist no Railway (tu fazes no dashboard)

### 1. Criar PostgreSQL

1. Projeto Railway → **+ New** → **Database** → **PostgreSQL**
2. Aguarda o serviço ficar **Active**

### 2. Ligar à app

No serviço da **app** (Dockerfile / Sloot), **Variables**:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_URL}}
```

- Clica em **Add variable** e usa a referência `${{NomeDoServicoPostgres.DATABASE_URL}}` (o nome do serviço pode ser `Postgres` ou `PostgreSQL`).
- **Remove** as variáveis antigas do Supabase (`db.cibzqalnxezwlzafjdow...`, pooler `6543`, etc.).
- **Mantém:** `JWT_SECRET`, `NODE_ENV=production`, `DEFAULT_TENANT_SLUG`, `SUPABASE_*`, `VITE_SUPABASE_*`, `FRONTEND_URL`, etc.
- **Não** defines `PORT`.

### 3. Redeploy

**Deploy** → **Redeploy** (ou push em `main`).

Nos **Deploy logs** deve aparecer:

```text
Aplicando migrations Prisma (migrate deploy)...
Migrations aplicadas com sucesso.
```

### 4. Popular dados de teste (opcional)

No PC, com a connection string do Postgres Railway:

1. Serviço **PostgreSQL** → **Connect** → copia `DATABASE_URL` (ou **Public URL** se precisares de acesso externo; ativa **TCP Proxy** se necessário).

2. Na pasta do projeto (raiz):

```powershell
$env:DATABASE_URL="postgresql://postgres:...@...railway.app:5432/railway"
$env:DIRECT_URL=$env:DATABASE_URL
$env:DEFAULT_TENANT_SLUG="two-brothers"
npm run db:railway:setup
cd server
npm run create:platform-admin -- admin@admin.com admin
```

(`create:platform-admin` só se precisares de login em `/admin` — o seed já cria staff em `/{slug}/barbeiros/login`.)

3. Confirma o slug do tenant: o seed usa `DEFAULT_TENANT_SLUG` ou `two-brothers` →  
   `https://TEU-DOMINIO/two-brothers/cliente`

---

## Verificação

| URL | Esperado |
|-----|----------|
| `/health` | `{ "status": "ok" }` |
| `/two-brothers/barbeiros/login` | Login `carlos@barberpro.com` / `123` |
| `/admin` | Login após `create:platform-admin` |
| `/two-brothers/cliente` | Agendamento público |

---

## Desenvolvimento local

Em `server/.env`, podes apontar para o Railway Postgres (mesmo URL em `DATABASE_URL` e `DIRECT_URL`) ou manter Supabase só em dev.

---

## Se no futuro precisares copiar dados reais

```bash
pg_dump "postgresql://postgres:...@db....supabase.co:5432/postgres" --no-owner --no-acl -F c -f backup.dump
pg_restore -d "postgresql://postgres:...@....railway.app:5432/railway" --no-owner --no-acl backup.dump
```

Requer [PostgreSQL client](https://www.postgresql.org/download/windows/) no Windows.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `relation "Tenant" does not exist` | Redeploy; confirma `DIRECT_URL` definido |
| Migrate falha no start | `DATABASE_URL` e `DIRECT_URL` iguais ao Postgres Railway |
| `/cliente` 404 ou tenant errado | Usa o slug do seed (`two-brothers`) ou ajusta `DEFAULT_TENANT_SLUG` |
| Reset de senha | Independente do Postgres — continua Supabase Auth + Redirect URLs |

Ver também: [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md), [SUPABASE-RESET-SENHA.md](./SUPABASE-RESET-SENHA.md).
