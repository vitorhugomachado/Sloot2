# Recuperação de senha do cliente (Supabase Auth)

O login do cliente continua no banco Prisma (`Customer`). O **e-mail de “esqueci a senha”** é enviado pelo **Supabase Auth**; após o utilizador definir a nova senha, o backend sincroniza o hash no Prisma.

## 1. Variáveis de ambiente

### Frontend (`.env` na raiz)

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Copie em **Supabase → Project Settings → API**.

### Backend (`server/.env`)

```env
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

A **service role** só no servidor — nunca no frontend.

Reinicie Vite e o servidor após alterar o `.env`.

## 2. URLs de redirecionamento no Supabase

**Authentication → URL Configuration**

| Campo | Exemplo (dev) |
|--------|----------------|
| Site URL | `http://localhost:5173` |
| Redirect URLs | `http://localhost:5173/**/redefinir-senha` |

Em produção, acrescente por tenant, por exemplo:

- `https://seudominio.com/two-brothers/redefinir-senha`
- `https://seudominio.com/lanotic/redefinir-senha`

Ou use um padrão que o Supabase aceite na sua região/plano.

## 3. E-mail no Supabase

**Authentication → Email**

- Ative **Confirm email** conforme a sua política (recomendado em produção).
- Em **Reset password**, personalize o template se quiser (assunto/corpo em português).
- Para testes: o Supabase envia para o e-mail real; em dev pode usar um e-mail seu.

Opcional: **Project Settings → Auth → SMTP** para enviar com o seu domínio (Resend, SendGrid, etc.).

## 4. Fluxo na aplicação

1. Cliente clica **Esqueci minha senha** no modal de login (agendamento ou portal).
2. `POST /api/customer-auth/forgot-password` — garante utilizador no Supabase Auth **e envia o e-mail** (servidor).
3. Link abre `/:slug/redefinir-senha`.
4. Nova senha → Supabase Auth + `POST /api/customer-auth/sync-password` → Prisma.

O e-mail **só é enviado** se existir cliente com esse e-mail **nesta barbearia** (tabela `Customer`). Caso contrário a API responde a mesma mensagem genérica (segurança), mas **não manda e-mail**.

## 4.1 E-mail não chegou?

1. **Supabase → Authentication → Users** — o e-mail aparece na lista após pedir recuperação?
2. **Authentication → Logs** — há erro de envio ou de redirect URL?
3. **Redirect URLs** — tem de incluir exatamente  
   `http://localhost:5173/two-brothers/redefinir-senha` (troca o slug se preciso).
4. **Spam / promoções** — o remetente costuma ser `noreply@mail.app.supabase.io`.
5. **Limite do plano gratuito** — poucos e-mails por hora; espera ou configura SMTP em **Project Settings → Auth → SMTP**.
6. Usa o **mesmo e-mail** com que te registaste na barbearia (login no agendamento).

## 5. Contas antigas e login Google

Clientes criados **antes** desta funcionalidade recebem um utilizador no Supabase Auth no primeiro “esqueci a senha” (se o e-mail existir na barbearia).

Novos cadastros já sincronizam o Auth no registo.

Quem entrou só com **Entrar com Google** passa a ser sincronizado no Supabase Auth no login e no “esqueci a senha” (identidade de e-mail para o link de recuperação). Clientes Google antigos: pedir recuperação outra vez após deploy.

## 6. Verificar no DevTools

Ao pedir recuperação, deve aparecer:

1. `POST /api/customer-auth/forgot-password` → 200  

O envio do e-mail é feito **no servidor** (não é obrigatório ver pedido ao `supabase.co` no browser).

Reinicia o **backend** após alterar `server/.env`. Opcional no servidor: `FRONTEND_URL=http://localhost:5173` se o redirect falhar sem header `Origin`.
