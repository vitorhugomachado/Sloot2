# Mídia da página de agendamento

A capa e a galeria do hub mobile usam um Railway Storage Bucket privado e S3 compatível. Logo, banner e foto dos profissionais continuam no mecanismo atual.

## Ambientes

- Crie um bucket privado separado em staging e outro em produção.
- No serviço da aplicação, configure `BOOKING_MEDIA_DRIVER=s3` e referencie `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION` e `ENDPOINT` do bucket do mesmo ambiente.
- Nunca exponha estas variáveis com prefixo `VITE_` e nunca copie credenciais do Railway para desenvolvimento ou CI.
- Em desenvolvimento, use `BOOKING_MEDIA_DRIVER=local`; os arquivos ficam em `server/.data/booking-media`, ignorado pelo Git.
- Em CI, deixe o driver local em uma área efêmera ou substitua o módulo por um storage falso nos testes isolados.

Os objetos são gravados somente pelo servidor em `tenants/<tenantId>/booking-page/<uuid>.webp`. O PostgreSQL guarda textos e UUIDs, nunca binários, caminhos do cliente ou URLs temporárias.

## Entrega e falhas

`GET /api/public/booking-media/:slug/:assetId` valida slug e UUID. Localmente entrega o WebP; no Railway redireciona para uma URL GET assinada de curta duração. Se o bucket estiver sem configuração, o editor desabilita uploads e a reserva continua funcional com o banner existente ou o placeholder.

O navegador reduz o arquivo e envia JPEG de até 2 MB. O backend valida, corrige orientação, remove metadados e gera WebP limitado a 1600 px. SVG e conteúdo inválido são recusados. O limite administrativo é 30 uploads por hora para cada combinação de usuário e tenant.

## Coleta de órfãos

O comando abaixo apenas inventaria objetos não publicados com mais de 24 horas:

```bash
npm --prefix server run media:cleanup
```

Para remover os objetos listados:

```bash
npm --prefix server run media:cleanup:apply
```

Agende o modo `apply` uma vez ao dia em cada ambiente. Rode primeiro o `dry-run` após qualquer mudança. A retenção de 24 horas evita quebrar caches quando uma capa ou foto publicada é substituída.

Antes de promover produção, registre backup do PostgreSQL e inventário do bucket. O deploy de produção continua condicionado a autorização explícita e tag imutável.
