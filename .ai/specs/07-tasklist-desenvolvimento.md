# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | 🟡 | tokens em `src/styles/tokens.css:1`, mas `src/modules/catalog.js` não usa nenhum `var(--...)` (cores hex soltas) |
| Estrutura SPA e roteamento simples | RNF02 | ✅ | `renderApp` em `src/modules/catalog.js:2517` e `navigateTo` em `src/modules/catalog.js:184` (login exigido em carrinho, pagamento e anúncio: `src/modules/catalog.js:186`); no Chrome headless (`npm run test:ui`, fora do `npm test`): troca de tela sem reload em `tests/ui/spa.ui.js:21`, tela protegida em `tests/ui/spa.ui.js:42`, catálogo vazio em `tests/ui/spa.ui.js:64` e com erro em `tests/ui/spa.ui.js:77`. A largura mobile-first (360–430px) do RNF02 não tem teste |
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
- Cupons: valem a partir do valor mínimo (inclusive), mas o texto da tela diz
  "acima de R$ X". Decidir qual dos dois está certo.
