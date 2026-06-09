# Reset de senha — equipe (staff)

## Decisão MVP

**Self-service por e-mail fica fora do escopo do MVP.** O reset de senha da equipe é feito pelo **gerente** ou pelo **admin da plataforma**.

Motivos:

- O login staff já funciona com e-mail/senha no Prisma; não há integração de e-mail transacional para staff (diferente do fluxo cliente com Supabase).
- Implementar reset self-service exigiria SMTP/Supabase, templates, rotas e UX extra — sem bloquear o lançamento.
- O painel `/admin` já permite redefinir a senha do gerente de qualquer tenant.

## Quem pode redefinir

| Papel | Como |
|-------|------|
| **Admin plataforma** | `/admin` → Barbearias → tenant → aba Gerente → campo "Nova senha" |
| **Gerente** | Painel **Usuários** → editar profissional → alterar senha (via API `PUT /barbers/:id`) |
| **Barbeiro** | Pedir ao gerente ou ao suporte Slooti |

## O que o utilizador vê

Na tela `/{slug}/login`, abaixo do botão Entrar:

> Esqueceu a senha? Peça ao gerente da barbearia ou ao suporte Slooti para redefinir o acesso.

Não há link "Esqueci minha senha" ativo para staff (evita promessa quebrada).

## Pós-MVP (opcional)

- Reset por e-mail com o mesmo stack do cliente (Supabase Auth) ou SMTP dedicado.
- Link "Redefinir senha" no login staff com fluxo `forgot-password` + token.
