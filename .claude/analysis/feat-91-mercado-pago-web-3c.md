# Análise da parte 3c (web) do Mercado Pago

Análise feita por agente Opus 5.5 (planejamento) em 2026-11-18, antes de qualquer edição de código.
Spec: `.ai/specs/10-pagamentos-mercado-pago.md`. Issue #91. Branch `feat/91-mercado-pago-web-3c`,
criada a partir da `origin/main`, com linha de base de 398 testes, 17 avisos de lint e typecheck limpo.

## Ordem de integração
- Os PRs #95 e #96 já estão mesclados na `main`.
- Esta branch parte da `origin/main`; não há rebase a fazer.

## Passos e níveis (escala aprovada pelo usuário)
1. **Regras de pagamento no domínio compartilhado** — nível 3, Haiku 5.5, esforço medium.
   Mover `isSafeCheckoutUrl`, `orderActions`, `paymentResultMessage`, `cartSellerProblem` para
   `packages/domain/payments.js`; criar `orderIdFromSearch`; o app reexporta via `src/domain.ts`.
   Testes em `tests/payments.test.js`.
2. **Serviços de API** — nível 2, Haiku 5.5, esforço low. `loadAppConfig`, `syncOrder`, `cancelOrder`
   em `src/services/api.js`; `Idempotency-Key` gerada uma vez por fechamento. Teste em
   `tests/api-client.test.js`.
3. **Módulo `src/modules/mp-checkout.js`** — nível 3, Haiku 5.5, esforço medium. Funções curtas, com
   `// @ts-check`. O `checkoutUrl` nunca entra no HTML; o botão chama `window.payOrder(id)`.
4. **Ligar em `catalog.js`** — nível 4, Haiku 5.5 com Opus no planejamento e na revisão. Desvios
   pequenos: `state.payments` do `app-config`; tela de pagamento; confirmação de outro vendedor;
   fechamento com `returnTo: 'web'`, decidido pela resposta do servidor; Meus Pedidos sem rastreio
   para pedido não pago. Não reescrever `catalog.js`.
5. **Volta do Mercado Pago** — nível 5, Opus 5.5 revisa. Ler `?pedido=` com validação; limpar a URL
   antes do sync; resultado vindo do servidor; recarregar não confere de novo. Teste em
   `tests/ui/mp-return.ui.js`.
6. **Blueprint** — nível 1, Haiku 5.5, esforço low. Seção 15 em
   `docs/tasks/91-mercado-pago/blueprint.md`, com `arquivo:linha` na mesma linha do ✅.

## Critérios de aceite (CA34 a CA40)
- CA34: as regras compartilhadas existem só em `packages/domain/payments.js`; o app reexporta.
- CA35: com `simulado`, carrinho, pagamento e pedidos ficam como hoje.
- CA36: com Mercado Pago ligado, um vendedor por carrinho, conferido no catálogo ao vivo.
- CA37: fechamento com `returnTo: 'web'` e `Idempotency-Key`; redireciona só para `https` do
  Mercado Pago; sem toast de aprovado e sem moedas antes do pagamento.
- CA38: volta com `?pedido=` validado, URL limpa antes do sync, resultado do servidor.
- CA39: Meus Pedidos com Pagar agora, Conferir pagamento e Cancelar; pedido não pago sem rastreio.
- CA40: lint com no máximo 17 avisos; `npm test`, `npm run typecheck`, `npm run test:ui` e os testes
  do app verdes.

## Decisões que dependem do usuário (não decididas aqui)
1. Telas do vendedor e do master na web: recomendado deixar para a parte 3d.
2. Refatorar `payment.ts` no app: recomendado sim, sem subir a versão do APK.
3. Forma de pagamento simulada: recomendado esconder só com `mercadopago`.
4. Moedas: recomendado dar só quando o pedido estiver pago.
5. Volta sem login: recomendado guardar o pedido só em memória.

## Riscos e o que não mexer
- Não reescrever `catalog.js` nem corrigir as cores hex existentes.
- O modo simulado tem que se comportar como hoje.
- Não mudar o servidor (`server.js`, `payments.js`); se mudar, atualizar a spec 05 no mesmo PR.
- Não editar `.env` nem `.mcp.json`; nada de cartão na web.
- A volta real só se testa no sandbox com `APP_URL` https público.

## Não verificado nesta análise
- RF-01 e RF-04 da spec 10 inteiros.
- `tests/api-client.test.js` e `apps/mobile/src/screens/OrdersScreen.tsx`.
- Se o `status` gravado no pedido aguardando é sempre "Aguardando pagamento" (há a linha
  `apps/api/payments.js:153` como referência, sem leitura completa do fluxo).
