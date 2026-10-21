# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | 🟡 | tokens em `src/styles/tokens.css:1`, mas `src/modules/catalog.js` não usa nenhum `var(--...)` (cores hex soltas) |
| Estrutura SPA e roteamento simples | RNF02 | ✅ | `renderApp` em `src/modules/catalog.js:2478` e `navigateTo` em `src/modules/catalog.js:129` (login exigido em carrinho, pagamento, anúncio e financeiro: `src/modules/catalog.js:132`); no Chrome headless (`npm run test:ui`, fora do `npm test`): troca de tela sem reload em `tests/ui/spa.ui.js:31`, tela protegida em `tests/ui/spa.ui.js:54`, catálogo vazio em `tests/ui/spa.ui.js:70` e com erro em `tests/ui/spa.ui.js:83`. A largura mobile-first (360–430px) do RNF02 não tem teste |
| Catálogo compartilhado carregado pela API | RF02 | ✅ | carga em `src/modules/catalog-sync.js:12` (carregando, sucesso e erro em `tests/services.test.js:293`) com o desfecho de `src/services/catalog-load.js:10` (sucesso, vazio e falha em `tests/services.test.js:228`); anúncio novo aparece no GET (`tests/api.test.js:169`) |
| Cálculo do carrinho e criação do pedido | RF03, RF04 | ✅ | regras em `src/services/commerce.js:47` (`tests/services.test.js:25`); total calculado no servidor (`tests/api.test.js:144`) |
| Meios de pagamento (Pix, cartão em 6x, boleto) | RF04 | 🟡 | só na tela (`src/modules/catalog.js:1623`); pagamento simulado, sem teste |
| Dashboard financeiro ligado ao histórico de compras | RF01 | ✅ | extrato da conta montado no servidor a partir dos pedidos e dos lançamentos manuais gravados (`server.js:574`, `server.js:581`; regra em `src/services/finance.js:42`): compra aprovada no extrato do comprador e do vendedor, outra conta vê vazio (`tests/finance.test.js:222`), lançamento manual sobrevive a outra gravação (`tests/finance.test.js:243`); cards, gráfico e extrato do mesmo resumo (`src/services/finance.js:74`, tela em `src/modules/catalog.js:1790`) com vazio, receita e filtro (`tests/finance.test.js:23`, `tests/finance.test.js:35`, `tests/finance.test.js:60`); carga da tela em `src/modules/finance-sync.js:12` (`tests/finance.test.js:125`) |
| Rastreamento em 4 estágios (OrderTracker) | RF05 | ✅ | `src/modules/tracker.js:8` (`tests/services.test.js:137`) |
| Chatbot 24h com árvore de decisão e transferência humana | RF06 | ✅ | `src/modules/support.js:1` e `src/services/support.js:1` (`tests/services.test.js:83`, `tests/services.test.js:166`) |
| Drag-to-scroll nos carrosséis no desktop | RNF03 | ✅ | `enableDragToScroll` em `src/modules/catalog.js:2522`, registrado a cada render em `src/modules/catalog.js:2516`; o arraste não vira clique (`src/modules/catalog.js:2560`) e o foco do teclado mostra o chip inteiro (`src/modules/catalog.js:2567`, contorno em `src/styles/ui.css:248`). No Chrome headless em viewport de desktop (`npm run test:ui`): direção do arraste em `tests/ui/drag-scroll.ui.js:54`, sem clique indevido em `tests/ui/drag-scroll.ui.js:69`, teclado em `tests/ui/drag-scroll.ui.js:97` e toque em `tests/ui/drag-scroll.ui.js:111` |

## Divergências encontradas (07/10/2026)

- Catálogo: resolvido, a tela carrega o catálogo pela API (PR #13, issue #4; ver
  a linha RF02 acima). O anúncio publicado sem conexão, que ficava só no
  navegador e sumia na próxima carga, deixou de existir: sem conexão o anúncio
  não é publicado e o vendedor continua no formulário (issue #17).
- Cupons: resolvido (issue #10), vale a regra inclusiva já aplicada no código e
  agora explícita na RF03 (`src/services/commerce.js:32`, limite exato em
  `tests/services.test.js:205`). Os textos que diziam "acima de R$ X" passaram a
  "a partir de R$ X": regras (`src/services/commerce.js:13`), mensagem do
  `CartEngine` (`src/modules/cart.js:45`) e chatbot (`src/services/support.js:31`),
  com teste em `tests/coupons.test.js:11`, `tests/coupons.test.js:17` e
  `tests/coupons.test.js:26`; lista de cupons da tela em
  `src/modules/catalog.js:1591` (sem teste). "Acima de R$ 800,00" ficou só para o
  frete grátis automático.
- Financeiro (issue #6): o RF01 de `.ai/specs/02-requisitos-funcionais.md` é
  "Cadastro com perfil Comprador/Vendedor", não o dashboard financeiro, que não
  tem RF próprio. Pedido gravado antes da #6 só com a data "Hoje" fica fora do
  financeiro (não tem data real). "Meus Pedidos" ainda não carrega do servidor
  e esvazia ao recarregar a página (`loadOrders` não é chamado).
