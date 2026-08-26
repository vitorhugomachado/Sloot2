# Regras obrigatórias para agentes de IA

Este arquivo é a fonte canônica de instruções para qualquer agente de IA que altere este repositório. Ele se aplica a todo o projeto. Em caso de conflito com outra documentação do repositório, siga este arquivo e os workflows em `.github/workflows/`.

## Fluxo Git obrigatório

- Nunca faça commit ou push diretamente na branch `main`.
- Antes de alterar código, atualize a `main` e crie uma branch `feature/*`, `fix/*` ou `chore/*` conforme o tipo da mudança.
- Uma autorização genérica como “faça commit e push” autoriza apenas commit e push na branch de trabalho.
- Execute testes e builds proporcionais à mudança antes do push.
- Depois do push, abra um Pull Request para `main` e aguarde os checks obrigatórios `checks` e `analyze`.
- Corrija checks com falha na mesma branch. Não contorne, desative ou remova proteções para concluir um trabalho.
- Faça merge por squash somente quando os checks estiverem verdes e o usuário tiver autorizado o merge ou solicitado a entrega completa da mudança.

## Ambientes e deploy

- Pull Requests executam CI com PostgreSQL efêmero, migrations, seed sintético, testes, build Vite, build Docker e análise de segurança.
- Merge em `main` publica exclusivamente no projeto Railway isolado de staging pelo workflow `Deploy staging`.
- Staging possui banco, domínio, variáveis e credenciais próprios. Nunca forneça a ele segredo ou URL de produção.
- Produção não possui autodeploy por push ou merge. Ela só pode ser promovida pelo workflow `Deploy production (approved tag only)` mediante tag imutável `vX.Y.Z`.
- Nunca crie tag, GitHub Release, deployment ou migration produtiva sem autorização explícita e separada do usuário para aquela versão.
- Antes de uma promoção, confirme: CI verde, mesmo SHA saudável no staging, ausência de migration destrutiva, backup recente restaurado e validado, `PRODUCTION_BACKUP_ID` registrado e possibilidade de rollback.
- A aprovação manual do GitHub Environment `production` pertence ao proprietário. Não tente contorná-la.
- O workflow produtivo valida `/health`, `/ready`, página inicial e SHA, observa a versão por 15 minutos e só então cria o GitHub Release.

## Proteção de dados

- Nunca use o banco produtivo para testes, seeds, desenvolvimento ou migrations experimentais.
- Nunca execute `prisma migrate reset`, `db:seed` ou bootstrap de staging em produção.
- Migrations devem passar primeiro no PostgreSQL efêmero do CI e no staging.
- Mudanças de schema produtivas devem ser compatíveis com a versão anterior e usar expand/contract quando remover ou renomear estruturas.
- Não grave tokens, senhas, URLs de banco ou conteúdo de secrets em arquivos, commits, logs ou Pull Requests.

## Verificação e rollback

- Considere staging aprovado apenas quando o workflow terminar verde e `/health`, `/ready`, página inicial e SHA esperado forem validados.
- Após promoção, se qualquer verificação falhar, interrompa o fluxo e restaure o deployment anterior da aplicação na Railway.
- Para banco, prefira correção para frente ou restauração em serviço paralelo; nunca faça reset destrutivo.
- A versão produtiva anterior deve permanecer disponível até a nova versão estar pronta e saudável.

O procedimento operacional completo está em [`docs/STAGING-PRODUCTION.md`](docs/STAGING-PRODUCTION.md).
