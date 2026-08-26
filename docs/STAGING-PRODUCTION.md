# Staging e produção com isolamento

O push em `main` publica somente no projeto Railway de staging. Produção aceita apenas tags `vX.Y.Z` no GitHub Environment `production`, com aprovação manual.

## Configuração externa obrigatória

1. Crie um projeto Railway separado para staging, com PostgreSQL, domínio, variáveis e credenciais próprias. Configure `railway.staging.toml`, `RUN_MIGRATIONS_ON_START=false` e dados sintéticos.
2. No Environment `staging`, cadastre `RAILWAY_TOKEN_STAGING`, `RAILWAY_SERVICE_STAGING` e `STAGING_URL`. No `production`, cadastre os equivalentes de produção e o secret `PRODUCTION_BACKUP_ID`.
3. Antes de conectar o workflow, desative o autodeploy antigo da produção e confirme que o deployment atual continua ativo. Não altere banco, domínio ou credenciais atuais.
4. Proteja `main` com PR/checks/histórico linear e proteja tags `v*` contra alteração/exclusão. Exija aprovação manual no Environment `production`.

Antes da primeira promoção, registre SHA produtivo, `/health` 200, deployment Railway e `pg_dump` criptografado. Restaure o dump em banco descartável e valide tabelas/contagens; só então preencha `PRODUCTION_BACKUP_ID`.

## Promoção e rollback

O workflow de produção exige que a tag esteja em `main`, staging esteja saudável no mesmo SHA, não haja migration destrutiva e exista backup registrado. O primeiro release deve conter somente infraestrutura/documentação/testes. Em falha, o Railway mantém a versão anterior: use **Redeploy** do deployment anterior e confirme `/health` e `/ready`. Nunca use `prisma migrate reset`.

`railway.toml` permanece com `/health` para não modificar o serviço produtivo atual. Depois de validar `/ready` em staging, altere o healthcheck de produção em uma release separada e aprovada.
