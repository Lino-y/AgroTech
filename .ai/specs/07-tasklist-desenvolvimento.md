# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | 🟡 | tokens em `src/styles/tokens.css:1`, mas `src/modules/catalog.js` não usa nenhum `var(--...)` (cores hex soltas) |
| Estrutura SPA e roteamento simples | RNF02 | 🟡 | `renderApp` em `src/modules/catalog.js:2187`; sem teste |
| Catálogo compartilhado carregado pela API | RF02 | ✅ | carga em `src/modules/catalog-sync.js:12` (carregando, sucesso e erro em `tests/services.test.js:293`) com o desfecho de `src/services/catalog-load.js:10` (sucesso, vazio e falha em `tests/services.test.js:228`); anúncio novo aparece no GET (`tests/api.test.js:169`) |
| Cálculo do carrinho e criação do pedido | RF03, RF04 | ✅ | regras em `src/services/commerce.js:47` (`tests/services.test.js:25`); total calculado no servidor (`tests/api.test.js:144`) |
| Meios de pagamento (Pix, cartão em 6x, boleto) | RF04 | 🟡 | só na tela (`src/modules/catalog.js:1623`); pagamento simulado, sem teste |
| Dashboard financeiro ligado ao histórico de compras | RF01 | 🟡 | a compra soma em `state.finance` (`src/modules/catalog.js:854`); gráfico em `src/components/FinanceChart.js:7`; sem teste |
| Rastreamento em 4 estágios (OrderTracker) | RF05 | ✅ | `src/modules/tracker.js:8` (`tests/services.test.js:137`) |
| Chatbot 24h com árvore de decisão e transferência humana | RF06 | ✅ | `src/modules/support.js:1` e `src/services/support.js:1` (`tests/services.test.js:83`, `tests/services.test.js:166`) |
| Drag-to-scroll nos carrosséis no desktop | RNF03 | 🟡 | `src/modules/catalog.js:2235`; sem teste |

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
