# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | 🟡 | tokens em `src/styles/tokens.css:1`, mas `src/modules/catalog.js` não usa nenhum `var(--...)` (cores hex soltas) |
| Estrutura SPA e roteamento simples | RNF02 | 🟡 | `renderApp` em `src/modules/catalog.js:2187`; sem teste |
| Cálculo do carrinho e criação do pedido | RF03, RF04 | ✅ | regras em `src/services/commerce.js:47` (`tests/services.test.js:25`); total calculado no servidor (`tests/api.test.js:144`) |
| Meios de pagamento (Pix, cartão em 6x, boleto) | RF04 | 🟡 | só na tela (`src/modules/catalog.js:1623`); pagamento simulado, sem teste |
| Dashboard financeiro ligado ao histórico de compras | RF01 | 🟡 | a compra soma em `state.finance` (`src/modules/catalog.js:854`); gráfico em `src/components/FinanceChart.js:7`; sem teste |
| Rastreamento em 4 estágios (OrderTracker) | RF05 | ✅ | `src/modules/tracker.js:8` (`tests/services.test.js:137`) |
| Chatbot 24h com árvore de decisão e transferência humana | RF06 | ✅ | `src/modules/support.js:1` e `src/services/support.js:1` (`tests/services.test.js:83`, `tests/services.test.js:166`) |
| Drag-to-scroll nos carrosséis no desktop | RNF03 | 🟡 | `src/modules/catalog.js:2235`; sem teste |

## Divergências encontradas (07/10/2026)

- Catálogo: `GET /api/products` existe (`.ai/specs/05-openapi-spec.md`), mas a
  tela nunca chama `loadProducts` (`src/services/api.js:30`) e começa com o
  catálogo vazio (`src/modules/catalog.js:66`). O anúncio de um vendedor só
  aparece no navegador dele. Decidir se o catálogo deve vir da API.
- Cupons: valem a partir do valor mínimo (inclusive), mas o texto da tela diz
  "acima de R$ X". Decidir qual dos dois está certo.
