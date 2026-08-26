# Staging e produção com isolamento

O push em `main` publica somente no projeto Railway de staging. Produção aceita apenas tags `vX.Y.Z` no GitHub Environment `production`, com aprovação manual.

## Fluxo diário

1. Atualize `main` e crie uma branch `feature/*`, `fix/*` ou `chore/*`; nunca faça push direto em `main`.
2. Execute os testes, faça commit e push da branch e abra um Pull Request.
3. Aguarde os checks obrigatórios `checks` e `analyze`; faça merge por squash somente com ambos verdes.
4. O merge publica automaticamente em staging. Valide `/health`, `/ready`, página inicial, SHA e o comportamento alterado.
5. Somente após staging aprovado e backup restaurado e validado, crie uma tag `vX.Y.Z` no mesmo SHA da `main`.
6. Aprove manualmente o Environment `production`. O workflow valida e observa a nova versão por 15 minutos antes de concluir o GitHub Release.

## Configuração externa obrigatória

1. Crie um projeto Railway separado para staging, com PostgreSQL, domínio, variáveis e credenciais próprias. Configure `railway.staging.toml`, `RUN_MIGRATIONS_ON_START=false`, `STAGING_BOOTSTRAP=true` somente nesse projeto e dados sintéticos. O bootstrap existe porque o histórico não contém migration inicial; nunca o habilite em produção.
2. No Environment `staging`, cadastre `RAILWAY_TOKEN_STAGING`, `RAILWAY_SERVICE_STAGING` e `STAGING_URL`. No `production`, cadastre os equivalentes de produção e o secret `PRODUCTION_BACKUP_ID`.
3. Antes de conectar o workflow, desative o autodeploy antigo da produção e confirme que o deployment atual continua ativo. Não altere banco, domínio ou credenciais atuais.
4. Proteja `main` com PR/checks/histórico linear e proteja tags `v*` contra alteração/exclusão. Exija aprovação manual no Environment `production`.

Antes da primeira promoção, registre SHA produtivo, `/health` 200, deployment Railway e `pg_dump` criptografado. Restaure o dump em banco descartável e valide tabelas/contagens; só então preencha `PRODUCTION_BACKUP_ID`.

## Promoção e rollback

O workflow de produção exige que a tag esteja em `main`, staging esteja saudável no mesmo SHA, não haja migration destrutiva e exista backup registrado. O primeiro release deve conter somente infraestrutura/documentação/testes. Em falha, o Railway mantém a versão anterior: use **Redeploy** do deployment anterior e confirme `/health` e `/ready`. Nunca use `prisma migrate reset`.

`railway.toml` permanece com `/health` para não modificar o serviço produtivo atual. Depois de validar `/ready` em staging, altere o healthcheck de produção em uma release separada e aprovada.
