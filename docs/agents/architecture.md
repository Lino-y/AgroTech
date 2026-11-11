# Arquitetura e padrões de código

Leitura obrigatória para agentes antes de codar (importado no `CLAUDE.md`,
apontado no `AGENTS.md`). Cada regra cita de onde vem: spec em `.ai/specs/`
ou código real em `arquivo:linha`. Mudar uma regra daqui pede ADR em
`docs/adr/` (via `/grill-with-docs`), não uma edição silenciosa.

## Restrições de stack (não mude sem ADR)

- SPA em JavaScript puro com módulos ES, **sem framework e sem build**
  (`.ai/specs/04-arquitetura-e-engenharia.md`). Nada de React, Vue, bundler
  ou TypeScript compilado; tipos só em JSDoc (ver "Contratos").
  **Exceção registrada (ADR-0001, 2026-11-11):** `apps/mobile` usa React Native,
  Expo, Metro e TypeScript, isolado em `apps/mobile/` com lockfile próprio. Só
  o build Android (APK) está previsto. A SPA e a API continuam sem build.
- Mobile-first, 360–430px, sem recarregar a página
  (`.ai/specs/03-requisitos-nao-funcionais.md`, RNF02; contêiner de 430px em
  `src/styles/tokens.css:31`).
- API em Express 4 em `apps/api/server.js`, dados no arquivo `apps/api/data/db.json` lido e
  gravado só por `readDb`/`writeDb` (`apps/api/server.js:229`, `apps/api/server.js:241`). Banco,
  ORM ou fila novos só com ADR.
- Dependência nova só com pedido explícito do usuário. Antes de instalar,
  confira que o pacote existe e é o pretendido (`npm view <pacote>`): nome
  inventado por IA é porta de entrada de pacote malicioso.

## Onde cada coisa mora

| Camada | Onde | Regra | Exemplo real |
|---|---|---|---|
| Regra de negócio | `packages/domain/` (API e SPA) e `src/services/` (só da SPA) | função pura, sem DOM nem `fetch`, testável no Node, com JSDoc; o ESLint dá a `packages/` só os globais do ECMAScript (ADR-0002) | `calculateCartSummary` (`packages/domain/commerce.js:50`) |
| Acesso à API | `src/services/api.js` | todo `fetch` passa por `apiRequest`, que põe o token e trata 401/403 | `src/services/api.js:12` |
| Estado e fluxo | `src/modules/` | classes e orquestração; as telas ficam em `catalog.js` | `CartEngine` (`src/modules/cart.js:3`) |
| HTML reutilizável | `src/components/` | função que devolve string HTML | `src/components/ProductCard.js:1` |
| Estilo | `src/styles/` | cor e fonte por token (`var(--forest)` etc.), RNF01 | `src/styles/tokens.css:1` |
| API HTTP | `apps/api/server.js` | rota sob `/api`; `authenticate` quando exige login, `requireAdmin` para admin; erro como `{ message }` com o status certo | `apps/api/server.js:548`, `apps/api/server.js:314` |

## Padrões atuais (siga; não crie um segundo padrão sem ADR)

- Tela é string HTML trocada via `innerHTML` em `renderApp`
  (`src/modules/catalog.js:2483`), com estado no objeto `state`
  (`src/modules/catalog.js:69`).
- Evento é `onclick="..."` chamando função exposta em `window` (85 ocorrências de `onclick=` e 44 atribuições a `window.` em `catalog.js`).
- Dívida conhecida, **não copie**: `catalog.js` tem 2.644 linhas, 627 cores
  hex literais e nenhum `var(--...)` (fere RNF01), e funções com
  complexidade de até 72 (`aiFillProduct`, `src/modules/catalog.js:486`). Código novo usa os
  tokens e funções curtas; o `npm run lint` avisa quando passa do limite.

## Contratos antes do código

- Endpoint novo ou alterado: atualize `.ai/specs/05-openapi-spec.md` (rota,
  auth, request, response, erros) no mesmo PR, antes da implementação.
- Função nova em `src/services/`: JSDoc com `@param`/`@returns`, e o arquivo
  começa com `// @ts-check` (exemplo: `src/services/cart.js:1`).
  `npm run typecheck` barra `any` implícito e uso fora do contrato.
- Formato novo de dado no `db.json`: descreva na seção Contratos do
  blueprint (`.ai/templates/blueprint-template.md`).
- Entrada do usuário é validada no `apps/api/server.js`, nunca só no front:
  - texto que vai virar HTML passa por `cleanText` (`apps/api/server.js:257`);
  - link de imagem passa por `safeImageUrl` (`apps/api/server.js:262`);
  - perfil no cadastro só entre `SIGNUP_ROLES` (`apps/api/server.js:251`), e ADMIN nunca
    vem do corpo da requisição;
  - preço e total saem do catálogo e de `calculateCartSummary`, nunca do valor
    que o cliente manda (`apps/api/server.js:638`);
  - dado de um usuário só volta para ele mesmo ou para o ADMIN (ex.: pedidos).
- Só `src/` (menos `src/data/`, onde o banco morava), `packages/domain/` e `assets/` são servidos
  como arquivo; não sirva a raiz do projeto.

## Testes

- `node:test` + `node:assert/strict` em `tests/*.test.js`
  (`tests/services.test.js:1`); não adicione Jest nem Vitest.
- Rota da API se testa de verdade: `tests/api.test.js` sobe o `apps/api/server.js`
  numa porta livre com banco descartável (`DATA_FILE`) — nunca contra o
  `apps/api/data/db.json` local.
- Regra de negócio nova ou corrigida ganha teste que falha se a regra
  quebrar, inclusive no limite (ex.: subtotal de exatamente R$ 800 no frete
  grátis).
- Isole o efeito testado: um carrinho de R$ 1.000 já tem frete grátis
  sozinho, então não prova nada sobre o cupom `FRETEGRATIS`.
- Teste de tela: `tests/ui/*.ui.js` roda no Chrome (ou Edge) headless pelo DevTools Protocol, com `npm run test:ui`. Fica fora do `npm test` e do `npm run verify`, e pula sem falhar quando não há navegador. O helper compartilhado é `tests/ui/browser.js`; `docs/setup.md` explica como rodar.

## Antes do commit

`npm run lint`, `npm run typecheck` e `npm test`. O pre-commit
(`.githooks/pre-commit`) roda os dois primeiros nos `.js` do commit; aviso
de complexidade não barra, mas não deixe a contagem subir.
