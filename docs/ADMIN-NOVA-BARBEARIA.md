# Nova barbearia no painel `/admin`

Guia para criar clientes (tenants) na plataforma slooti. Tudo grava no **PostgreSQL do Railway** — sem Supabase, Vercel ou seed por barbearia.

## Fluxo

1. Entras em `https://TEU-DOMINIO/admin` com utilizador **PlatformAdmin**
2. **Barbearias** → **Nova barbearia**
3. Preenches: nome da loja, slug (URL), nome do gerente, email e senha do gerente
4. O sistema cria na base de dados:
   - registo **Tenant** (barbearia)
   - um **Barber** com role **Gerente** e permissões completas
5. Aparece um banner com links para copiar:
   - `https://TEU-DOMINIO/{slug}` — agendamento público
   - `https://TEU-DOMINIO/{slug}/login` — login da equipa

Código: [`CreateTenantModal.jsx`](../src/pages/admin/CreateTenantModal.jsx) → `POST /api/platform/tenants` → [`createTenant.js`](../server/src/lib/createTenant.js).

## Pré-requisitos (uma vez no projeto)

| Item | Como verificar / fazer |
|------|-------------------------|
| App Railway activa | `npm run railway:preflight -- https://TEU-DOMINIO` ou `/health` → `dbConfigured: true`, `dbHost` com `railway` |
| Variáveis no serviço **Sloot** | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV=production` |
| Login em `/admin` | Criar admin (ver abaixo) |

Se o preflight devolver **404 Application not found**, o projecto Railway está pausado ou o URL mudou — **Resume** no dashboard e confirma o domínio em **Settings → Networking**.

### Criar utilizador admin da plataforma

Com `DATABASE_URL` do Railway (TCP Proxy no PC ou `server/.env`):

```powershell
cd server
$env:DATABASE_URL="postgresql://..."
$env:DIRECT_URL=$env:DATABASE_URL
npm run create:platform-admin -- seu@email.com SuaSenhaSegura
```

Ou na raiz do projeto:

```powershell
npm run create:platform-admin -- seu@email.com SuaSenhaSegura
```

(Requer `DATABASE_URL` e `DIRECT_URL` no ambiente ou em `server/.env`.)

Depois acede a `https://TEU-DOMINIO/admin` e faz login.

## O que NÃO precisas por cada barbearia nova

- `npm run db:seed` (apaga dados — só para banco vazio de teste)
- Novo serviço Railway ou Postgres por cliente
- Configurar Supabase / Vercel
- SQL manual

## Depois de criar — o que o gerente faz

1. Login em `/{slug}/login` (email/senha do formulário)
2. **Definições**: serviços, horários, logo, redes sociais
3. Adicionar barbeiros em **Utilizadores** (se precisar)
4. Divulgar `/{slug}` aos clientes finais (registo na página pública)

## O que o sistema NÃO cria automaticamente

- Serviços (cortes, etc.)
- Horários de trabalho
- Outros barbeiros além do gerente
- Produtos / stock

## Validações automáticas

- Slug único (ex. `minha-barbearia`)
- Slugs reservados (`admin`, `cliente`, …) rejeitados
- Email do gerente único no sistema
- Senha com mínimo 4 caracteres

## Erros comuns

| Erro | Causa |
|------|--------|
| Não abre `/admin` / login falha | Falta `create:platform-admin` ou `JWT_SECRET` errado |
| Erro ao criar barbearia (500) | `DATABASE_URL` em falta no Railway ou app em crash loop |
| URL já em uso | Outro tenant com o mesmo slug |
| Reset senha cliente | Sem Supabase — só login normal na página `/{slug}` |

Links antigos (`/{slug}/cliente`, `/{slug}/barbeiros/login`, etc.) redireccionam automaticamente para as URLs novas.

Ver deploy: [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md).
