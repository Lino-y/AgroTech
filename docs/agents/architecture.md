# Arquitetura e padrões de código

Leitura obrigatória para agentes antes de codar (importado no `CLAUDE.md`,
apontado no `AGENTS.md`). Cada regra cita de onde vem: spec em `.ai/specs/`
ou código real em `arquivo:linha`. Mudar uma regra daqui pede ADR em
`docs/adr/` (via `/grill-with-docs`), não uma edição silenciosa.

## Restrições de stack (não mude sem ADR)

- SPA em JavaScript puro com módulos ES, **sem framework e sem build**
  (`.ai/specs/04-arquitetura-e-engenharia.md`). Nada de React, Vue, bundler
  ou TypeScript compilado; tipos só em JSDoc (ver "Contratos").
- Mobile-first, 360–430px, sem recarregar a página
  (`.ai/specs/03-requisitos-nao-funcionais.md`, RNF02; contêiner de 430px em
  `src/styles/tokens.css:31`).
- API em Express 4 no `server.js`, dados no arquivo `src/data/db.json` lido e
  gravado só por `readDb`/`writeDb` (`server.js:209`, `server.js:220`). Banco,
  ORM ou fila novos só com ADR.
- Dependência nova só com pedido explícito do usuário. Antes de instalar,
  confira que o pacote existe e é o pretendido (`npm view <pacote>`): nome
  inventado por IA é porta de entrada de pacote malicioso.

## Onde cada coisa mora

| Camada | Onde | Regra | Exemplo real |
|---|---|---|---|
| Regra de negócio | `src/services/` | função pura, sem DOM nem `fetch`, testável no Node, com JSDoc | `calculateCartSummary` (`src/services/commerce.js:49`) |
| Acesso à API | `src/services/api.js` | todo `fetch` passa por `apiRequest`, que põe o token e trata 401/403 | `src/services/api.js:3` |
| Estado e fluxo | `src/modules/` | classes e orquestração; as telas ficam em `catalog.js` | `CartEngine` (`src/modules/cart.js:5`) |
| HTML reutilizável | `src/components/` | função que devolve string HTML | `src/components/ProductCard.js:1` |
| Estilo | `src/styles/` | cor e fonte por token (`var(--forest)` etc.), RNF01 | `src/styles/tokens.css:1` |
| API HTTP | `server.js` | rota sob `/api`; `authenticate` quando exige login, `requireAdmin` para admin; erro como `{ message }` com o status certo | `server.js:484`, `server.js:308` |

## Padrões atuais (siga; não crie um segundo padrão sem ADR)

- Tela é string HTML trocada via `innerHTML` em `renderApp`
  (`src/modules/catalog.js:2182`), com estado no objeto `state`
  (`src/modules/catalog.js:59`).
- Evento é `onclick="..."` chamando função exposta em `window` (67 e 35
  ocorrências em `catalog.js`).
- Dívida conhecida, **não copie**: `catalog.js` tem 2.287 linhas, 575 cores
  hex literais e nenhum `var(--...)` (fere RNF01), e funções com
  complexidade de até 72 (`src/modules/catalog.js:475`). Código novo usa os
  tokens e funções curtas; o `npm run lint` avisa quando passa do limite.

## Contratos antes do código

- Endpoint novo ou alterado: atualize `.ai/specs/05-openapi-spec.md` (rota,
  auth, request, response, erros) no mesmo PR, antes da implementação.
- Função nova em `src/services/`: JSDoc com `@param`/`@returns`, e o arquivo
  começa com `// @ts-check` (exemplo: `src/services/cart.js:1`).
  `npm run typecheck` barra `any` implícito e uso fora do contrato.
- Formato novo de dado no `db.json`: descreva na seção Contratos do
  blueprint (`.ai/templates/blueprint-template.md`).
- Entrada do usuário é validada no `server.js`, nunca só no front:
  - texto que vai virar HTML passa por `cleanText` (`server.js:232`);
  - link de imagem passa por `safeImageUrl` (`server.js:237`);
  - perfil no cadastro só entre `SIGNUP_ROLES` (`server.js:226`), e ADMIN nunca
    vem do corpo da requisição;
  - preço e total saem do catálogo e de `calculateCartSummary`, nunca do valor
    que o cliente manda (`server.js:434`);
  - dado de um usuário só volta para ele mesmo ou para o ADMIN (ex.: pedidos).
- Só `src/` (menos `src/data/`) e `assets/` são servidos como arquivo; não
  sirva a raiz do projeto.

## Testes

- `node:test` + `node:assert/strict` em `tests/*.test.js`
  (`tests/services.test.js:1`); não adicione Jest nem Vitest.
- Rota da API se testa de verdade: `tests/api.test.js` sobe o `server.js`
  numa porta livre com banco descartável (`DATA_FILE`) — nunca contra o
  `src/data/db.json` do repositório.
- Regra de negócio nova ou corrigida ganha teste que falha se a regra
  quebrar, inclusive no limite (ex.: subtotal de exatamente R$ 800 no frete
  grátis).
- Isole o efeito testado: um carrinho de R$ 1.000 já tem frete grátis
  sozinho, então não prova nada sobre o cupom `FRETEGRATIS`.

## Antes do commit

`npm run lint`, `npm run typecheck` e `npm test`. O pre-commit
(`.githooks/pre-commit`) roda os dois primeiros nos `.js` do commit; aviso
de complexidade não barra, mas não deixe a contagem subir.
