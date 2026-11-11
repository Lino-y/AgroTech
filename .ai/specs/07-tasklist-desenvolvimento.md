# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | 🟡 | tokens em `src/styles/tokens.css:1`, mas `src/modules/catalog.js` não usa nenhum `var(--...)` (cores hex soltas) |
| Estrutura SPA e roteamento simples | RNF02 | ✅ | `renderApp` em `src/modules/catalog.js:2483` e `navigateTo` em `src/modules/catalog.js:156` (login exigido em carrinho, pagamento, anúncio, financeiro e pedidos: `src/modules/catalog.js:159`); no Chrome headless (`npm run test:ui`, fora do `npm test`): troca de tela sem reload em `tests/ui/spa.ui.js:31`, tela protegida em `tests/ui/spa.ui.js:54`, catálogo vazio em `tests/ui/spa.ui.js:70` e com erro em `tests/ui/spa.ui.js:83`. A largura mobile-first (360–430px) do RNF02 não tem teste |
| Catálogo compartilhado carregado pela API | RF02 | ✅ | carga em `src/modules/catalog-sync.js:16` (carregando, sucesso e erro em `tests/services.test.js:293`) com o desfecho de `src/services/catalog-load.js:10` (sucesso, vazio e falha em `tests/services.test.js:228`); anúncio novo aparece no GET (`tests/api.test.js:173`) |
| Cálculo do carrinho e criação do pedido | RF03, RF04 | ✅ | regras em `packages/domain/commerce.js:50` (`tests/services.test.js:29`); total calculado no servidor (`tests/api.test.js:148`); id do pedido, código de rastreio e id do anúncio sem repetição (`apps/api/ids.js:15`, `apps/api/ids.js:33`, `apps/api/ids.js:36`, gravados em `apps/api/server.js:509`, `apps/api/server.js:644` e `apps/api/server.js:650`), com unicidade em `tests/orders.test.js:25` e formato novo, com o pedido do seed ainda válido, em `tests/orders.test.js:144`; frete grátis só acima de R$ 800,00 no resumo (`packages/domain/commerce.js:55`, `tests/services.test.js:193`) e no `CartEngine` (`src/modules/cart.js:67`, `tests/shipping.test.js:20`), e a tela do carrinho só anuncia o frete grátis por compra quando o resumo diz que veio do valor, não do cupom FRETEGRATIS (`src/modules/catalog.js:1630`, `tests/shipping.test.js:11`; no Chrome headless em R$ 800,00, com o cupom e em R$ 800,01: `tests/ui/cart.ui.js:32`, fora do `npm test`) |
| Meios de pagamento (Pix, cartão em 6x, boleto) | RF04 | 🟡 | só na tela (`src/modules/catalog.js:1646`); pagamento simulado, sem teste |
| Dashboard financeiro ligado ao histórico de compras | — (sem RF próprio na spec 02) | ✅ | extrato da conta montado no servidor a partir dos pedidos e dos lançamentos manuais gravados (`apps/api/server.js:670`, `apps/api/server.js:677`; regra em `packages/domain/finance.js:45`): compra aprovada no extrato do comprador e do vendedor, outra conta vê vazio (`tests/finance.test.js:222`), lançamento manual sobrevive a outra gravação (`tests/finance.test.js:243`); cards, gráfico e extrato do mesmo resumo (`packages/domain/finance.js:77`, tela em `src/modules/catalog.js:1780`) com vazio, receita e filtro (`tests/finance.test.js:23`, `tests/finance.test.js:35`, `tests/finance.test.js:60`); carga da tela em `src/modules/finance-sync.js:12` (`tests/finance.test.js:125`) |
| Rastreamento em 4 estágios (OrderTracker) | RF05 | ✅ | `src/modules/tracker.js:8` (`tests/services.test.js:141`); "Meus Pedidos" (sem RF próprio na spec 02) exige login e carrega `GET /api/orders` ao abrir (`src/modules/catalog.js:905`, carga em `src/modules/orders-sync.js:12` com carregando, sucesso, vazio, falha e troca de conta em `tests/orders.test.js:50`, `tests/orders.test.js:64`, `tests/orders.test.js:70` e `tests/orders.test.js:79`); data de `createdAt` em dd/mm/aaaa, e "não registrada" no pedido antigo sem data real (`src/services/orders.js:11`, `tests/orders.test.js:36`); pedido novo sem o "Hoje" (`apps/api/server.js:613`, `tests/orders.test.js:162`). No Chrome headless (`npm run test:ui`): login e data em `tests/ui/orders.ui.js:36`, lista que sobrevive ao recarregar a página em `tests/ui/orders.ui.js:47`, falha com "Tentar novamente" em `tests/ui/orders.ui.js:68` e conta sem pedido em `tests/ui/orders.ui.js:86` |
| Chatbot 24h com árvore de decisão e transferência humana | RF06 | ✅ | `src/modules/support.js:1` e `src/services/support.js:1` (`tests/services.test.js:87`, `tests/services.test.js:170`) |
| Drag-to-scroll nos carrosséis no desktop | RNF03 | ✅ | `enableDragToScroll` em `src/modules/catalog.js:2552`, registrado a cada render em `src/modules/catalog.js:2525`; o arraste não vira clique (`src/modules/catalog.js:2590`) e o foco do teclado mostra o chip inteiro (`src/modules/catalog.js:2597`, contorno em `src/styles/ui.css:261`). No Chrome headless em viewport de desktop (`npm run test:ui`): direção do arraste em `tests/ui/drag-scroll.ui.js:54`, sem clique indevido em `tests/ui/drag-scroll.ui.js:69`, teclado em `tests/ui/drag-scroll.ui.js:97` e toque em `tests/ui/drag-scroll.ui.js:111` |

## Divergências encontradas (07/10/2026)

- Tasklist (issue #24, revisado em 10/11/2026): cada `arquivo:linha` acima foi
  conferido contra o código da `main` (ab320a7) e corrigido onde tinha andado.
  A linha do dashboard financeiro não tem RF próprio na spec 02 (ver a
  divergência da issue #6 abaixo); criar o RF é decisão de produto.
- Catálogo: resolvido, a tela carrega o catálogo pela API (PR #13, issue #4; ver
  a linha RF02 acima). O anúncio publicado sem conexão, que ficava só no
  navegador e sumia na próxima carga, deixou de existir: sem conexão o anúncio
  não é publicado e o vendedor continua no formulário (issue #17).
- Cupons: resolvido (issue #10), vale a regra inclusiva já aplicada no código e
  agora explícita na RF03 (`packages/domain/commerce.js:32`, limite exato em
  `tests/services.test.js:205`). Os textos que diziam "acima de R$ X" passaram a
  "a partir de R$ X": regras (`packages/domain/commerce.js:13`), mensagem do
  `CartEngine` (`src/modules/cart.js:45`) e chatbot (`src/services/support.js:31`),
  com teste em `tests/coupons.test.js:11`, `tests/coupons.test.js:17` e
  `tests/coupons.test.js:26`; lista de cupons da tela em
  `src/modules/catalog.js:1540` (sem teste). "Acima de R$ 800,00" ficou só para o
  frete grátis automático.
- Financeiro (issue #6): o RF01 de `.ai/specs/02-requisitos-funcionais.md` é
  "Cadastro com perfil Comprador/Vendedor", não o dashboard financeiro, que não
  tem RF próprio. Pedido gravado antes da #6 só com a data "Hoje" fica fora do
  financeiro (não tem data real) e, em "Meus Pedidos", aparece com a data "não
  registrada". "Meus Pedidos" passou a carregar do servidor ao abrir (issue #25;
  ver a linha RF05 acima).
