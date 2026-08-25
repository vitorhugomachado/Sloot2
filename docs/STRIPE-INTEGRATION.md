# Integração Stripe da Slooti

Esta base implementa Billing/Invoicing para cobrar as barbearias pelo SaaS. Pagamentos dos clientes das barbearias devem usar Stripe Connect com **direct charges** em contas conectadas; esse fluxo não deve reutilizar o cliente ou a assinatura SaaS.

## Plano recomendado

- Checkout hospedado em modo `subscription`, com preços mensais/anuais de valor fixo.
- Customer Portal para troca de forma de pagamento, plano e cancelamento ao fim do período.
- Webhooks assinados e deduplicados no banco; o acesso nunca deve ser liberado somente pelo redirect do Checkout.
- Smart Retries, emails de recuperação e atualização automática de cartões ativados no Dashboard.
- Hosted Invoice Page para faturas automáticas; `send_invoice` e termos líquidos apenas para contratos B2B negociados.
- Stripe Connect (SaaS Platform, direct charges) em uma segunda etapa para pagamentos entre clientes e barbearias.

## Configuração em test mode

1. Crie Products/Prices de teste e preencha `STRIPE_PRICE_MONTHLY` e `STRIPE_PRICE_ANNUAL`.
2. Configure as variáveis descritas em `railway-variables.env.example`; nunca use prefixo `VITE_` para segredos.
3. Aplique a migration Prisma e gere o client.
4. Registre `POST /api/stripe/webhook` e assine ao menos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
5. Teste eventos duplicados, fora de ordem, falha/retry, cancelamento e cartões de teste. Mantenha `STRIPE_ALLOW_LIVE_MODE=false`.

## API autenticada

- `GET /api/billing/status`
- `POST /api/billing/checkout` com `{ "priceId": "price_..." }` e header `Idempotency-Key`
- `POST /api/billing/portal`

As rotas retornam URLs hospedadas pela Stripe; o frontend deve redirecionar o navegador para elas.

## Antes de produção

Use chaves e Price IDs separados, crie um endpoint webhook live separado, revise impostos/nota fiscal brasileira com assessoria contábil, habilite alertas, defina política de inadimplência e faça um teste completo de compra, reembolso, disputa, cancelamento e reconciliação. Só então habilite explicitamente `STRIPE_ALLOW_LIVE_MODE=true`.
