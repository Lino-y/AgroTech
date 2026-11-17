# 07 - Tasklist de Desenvolvimento

Status: ✅ feito, com teste · 🟡 implementado sem teste automatizado, ou parcial ·
🔴 não feito. Item só vira ✅ com evidência `arquivo:linha` do código e do teste,
a mesma regra dos blueprints (`.ai/templates/blueprint-template.md`).

| Item | Requisito | Status | Evidência |
|---|---|---|---|
| Design tokens CSS | RNF01 | ✅ | tokens definidos em `src/styles/tokens.css:1`; `src/modules/catalog.js` usa `var(--...)` (668 substituições via `scripts/apply-tokens.js`); exceções em `.ai/specs/07-tasklist-desenvolvimento.md:40` |
| Estrutura SPA e roteamento simples | RNF02 | 🟡 | `renderApp` em `src/modules/catalog.js:2187`; sem teste |
| Cálculo do carrinho e criação do pedido | RF03, RF04 | ✅ | regras em `src/services/commerce.js:47` (`tests/services.test.js:25`); total calculado no servidor (`tests/api.test.js:144`) |
| Meios de pagamento (Pix, cartão em 6x, boleto) | RF04 | ✅ | máquina de estados em `src/services/payment.js:28`; rotas em `server.js:534` (`tests/api.test.js:169`); OpenAPI em `.ai/specs/05-openapi-spec.md:213` |
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

## Tokens aplicados (30/10/2026)

`src/modules/catalog.js` migrou hex literais para tokens de
`src/styles/tokens.css` (paleta `--green-*`, `--text-muted*`, `--error*`,
`--warn*`, `--white`, `--ink-*`, `--wheat`), com os **mesmos valores** —
identidade visual inalterada. Validação visual em 360px, 430px e desktop
(headless, sem erro de console).

**Nomes evitados de propósito:** `--forest-700/800/900`, `--leaf-*` e
`--muted` já existem em `src/styles/ui.css:1` com **valores diferentes**;
redefini-los em `tokens.css` trocaria cores silenciosamente. Os novos nomes
(`--green-*`, `--text-muted*`) não colidem.

**Exceções documentadas (hex restantes, todos one-off ou neutros sem papel
reutilizável):** `#EAF7EE` (fundo de card financeiro), `#DCEDC8` (fundo do
toggle de auth), `#1B3D27` (overlay do banner com foto), `#FFF1F3`/`#6B1E2B`
(card de despesas), `#FAFAFA`/`#EEEEEE`/`#E0E0E0`/`#F5F5F5` (neutros de
boleto/linha de pedido), `#212121`/`#37474F`/`#616161`/`#757575`/`#9E9E9E`/
`#BDBDBD` (escala de cinza Material, texto/código de boleto e cupom
indisponível), `#E0EBE2` (borda da navbar), `#FFF` (shorthand). Promover a
token só se reaparecerem em outra tela.
