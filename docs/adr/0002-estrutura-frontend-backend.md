# ADR-0002 — Estrutura de frontend e backend separados (`apps/` e `packages/`)

- **Status:** aceita em 2026-11-10 (decisões 1 a 4 aprovadas na issue #62)
- **Data:** 2026-11-10
- **Escopo:** organização de pastas e pacotes do repositório
- **Relacionada:** ADR-0001 (cliente mobile React Native + Expo), spec 08 e
  issue #62

## Contexto

Hoje o backend e o frontend web moram juntos na raiz:

- `server.js` é a API Express **e** o servidor dos arquivos da SPA: serve
  `/src` e `/assets` (`server.js:368`, `server.js:369`) e devolve `index.html`
  na rota coringa (`server.js:713`).
- O "banco" fica dentro da pasta servida, em `src/data/db.json`
  (`server.js:47`). Por isso existe uma guarda só para `/src`
  (`server.js:357`).
- O servidor importa 5 módulos de `src/services/` (`server.js:10` a
  `server.js:14`). `commerce`, `finance` e `catalog` também são usados pela
  SPA; `ids` e `write-queue` só pelo servidor.
- As ferramentas assumem esses caminhos: ESLint por pasta
  (`eslint.config.js:6` a `eslint.config.js:10`), tipos só em `src/**/*.js`
  (`jsconfig.json`), scripts (`package.json:8` a `package.json:18`), git hooks
  (`.githooks/pre-commit:16`, `.githooks/pre-commit:17`,
  `.githooks/pre-push:5`) e testes que sobem o `server.js` pelo caminho
  (`tests/api.test.js:28`, `tests/ui/browser.js:144`).
- A documentação tem 137 referências `arquivo:linha` para `server.js` e
  `src/` (46 e 91, contadas em 2026-11-10).

A ADR-0001 cria `apps/mobile` e mantém `server.js` e `src/` onde estão "durante
a transição". Isso deixa de bastar por dois motivos:

1. As regras de comércio passam a ter **três** consumidores (servidor, web e
   mobile). A ADR-0001 dizia para não copiar "monorepo completo antes de
   existir mais de um cliente ou pacote compartilhado"; agora existem os dois.
2. O servidor recalcula preço, frete e total (`calculateCartSummary`). Um
   cliente que calcula diferente mostra um valor que o servidor recusa.

## Decisão

Separar por **fronteira de código e de pacote**, sem serviço novo: a API segue
sendo o Express 4 com `db.json`.

```text
apps/
├─ api/      BACKEND  Express 4: server.js, banco em data/db.json, ids, write-queue
├─ web/      FRONTEND web legado: index.html, src/ (telas), assets/
└─ mobile/   FRONTEND nativo: React Native + Expo + TypeScript estrito
packages/
└─ domain/   regras puras compartilhadas: commerce, finance, catalog (categorias)
docs/  .ai/  tests/  .githooks/  .claude/   (continuam na raiz)
```

### Regras de dependência

- `apps/*` podem importar `packages/domain`; `packages/domain` não importa
  nada de `apps/*`, nem DOM, `fetch`, storage ou React Native.
- `apps/api`, `apps/web` e `apps/mobile` **não se importam entre si**. Falam só
  por HTTP, no contrato de `.ai/specs/05-openapi-spec.md`.
- Regra autoritativa (preço, estoque, frete, cupom, total, autorização) fica no
  backend; os frontends só apresentam e guardam estado de sessão, de tela,
  cache e fila.

### Como compartilhar o domínio sem build

`packages/domain` continua em JavaScript com módulos ES, JSDoc e
`// @ts-check` (o padrão de `src/services/cart.js` e `commerce.js`). Node, a
SPA e o Metro do Expo consomem direto. O mobile, em TypeScript estrito, lê os
tipos gerados do JSDoc com `tsc --emitDeclarationOnly`. Nada de TypeScript
compilado nem bundler na web ou na API.

### Como organizar o repositório

Campo `workspaces` do `package.json` da raiz (recurso nativo do npm, sem
dependência nova). Os comandos da raiz continuam: `npm start`, `npm test`,
`npm run verify`.

Os workspaces entram aos poucos, quando cada pacote ganha um manifesto próprio:
`packages/*` no passo A1 (o domínio, sem dependências) e `apps/*` quando um app
precisar do seu (o mobile, na Fase 1). Enquanto isso as dependências da API
ficam no `package.json` da raiz, para não mexer no lockfile sem necessidade.

### Sequência

Um PR por passo, com comportamento idêntico: `npm run verify`,
`npm run test:ui` e `npm run check:coherence` verdes em cada um.

| Passo | O que faz | Risco |
|---|---|---|
| **A1** | extrai `packages/domain` (`commerce`, `finance`, `catalog`); o caminho de import é o mesmo no disco e na URL (`/packages/domain/...`), então o mesmo `import` funciona na SPA e no Node | baixo |
| **A2** | move o backend para `apps/api`; o banco sai da pasta servida para `apps/api/data/` | médio |
| **A3** | move a SPA para `apps/web` | só vale quando a SPA for aposentada; **adiar** |

O passo A3 custa o remapeamento das referências e dos caminhos de teste sem
ganho funcional enquanto a SPA for o fallback servido pela API.

## Impacto nas ferramentas (checklist de cada passo que move arquivo)

| O quê | Onde hoje | O que fazer |
|---|---|---|
| Guarda de spec | `.ai/scripts/spec-guard.js:16` (`CODE_RE` reconhece só `src/`, `server.js` e `index.html`) | incluir `apps/` e `packages/`, com teste. **Sem isso a regra 09 deixa de valer em silêncio**: mudar código não exigiria mais atualizar a spec |
| Lint | `eslint.config.js:6` a `:10` | globs por pasta: web = navegador; api, domain e tests = Node; mobile = React Native |
| Tipos | `jsconfig.json`, `package.json:15` | incluir `packages/domain` e o que já tem `// @ts-check`; o mobile tem `tsconfig` próprio |
| Scripts | `package.json:8` a `:18` | `start` e `dev` apontam para `apps/api`; `verify` encadeia os workspaces |
| Git hooks | `.githooks/pre-commit:16` e `:17`, `.githooks/pre-push:5` | continuam chamando scripts da raiz |
| Testes | `tests/api.test.js:28`, `tests/ui/browser.js:144` e os imports `../src/...` (38 pontos) | caminhos novos; `tests/api.test.js:92` (confere que `server.js` não é servido) acompanha |
| Arquivos servidos | `server.js:357` a `:369`, `server.js:713` | a API serve `/packages/domain` (só essa pasta, com a mesma guarda); no A2 passa a servir `src/`, `assets/` e `index.html` a partir da raiz; no A3, a SPA a partir de `apps/web` |
| Documentação | 137 referências `arquivo:linha`, `README.md` (estrutura), `docs/agents/architecture.md` | script de remapeamento versionado em `.ai/scripts/` antes do A2 (o da #24 foi um script avulso, fora do repositório) + `npm run check:coherence` |
| Dados locais | `src/data/db.json` fora do git, na máquina de cada pessoa | no A2, mover o arquivo ou apontar `DATA_FILE`; avisar no PR |

## Alternativas

- **Não separar; só criar `apps/mobile` e deixar o resto na raiz** (leitura
  literal da ADR-0001). Menor custo agora, mas o mobile copia `commerce` e
  `finance`: a regra de total e frete passa a existir em três lugares. Fica
  como plano B se o gate preferir menor custo.
- **Repositório separado para o mobile.** O contrato passa a ser cópia ou
  pacote publicado, o teste de contrato deixa de rodar no mesmo PR e o fluxo de
  spec e PR dobra.
- **Domínio em TypeScript compilado.** Exige build para a SPA e para a API,
  contra a restrição "sem build" de `docs/agents/architecture.md:10`.
- **Turborepo ou Nx.** Dependência nova sem necessidade com três apps e um
  pacote; reavaliar se o `verify` ficar lento.

## Decisões aprovadas (2026-11-10, issue #62)

1. **Estrutura:** npm workspaces; passos A1 e A2 agora, A3 adiado. O plano B
   (só `apps/mobile`) foi descartado.
2. **Domínio:** JavaScript com JSDoc e `// @ts-check`, tipos gerados para o
   mobile. TypeScript compilado descartado.
3. **Teste de componente React Native:** `node:test` para lógica e serviços
   (como o spike); o E2E (Maestro ou Detox) é decidido na Fase 1, quando houver
   tela para testar. `jest-expo` não entra por enquanto, e a regra "não
   adicione Jest nem Vitest" (`docs/agents/architecture.md:68`) fica como está.
4. **Passo A3** (mover a SPA) adiado até a aposentadoria dela.

As demais decisões do gate (sessão, crash reporting, distribuição, orçamento
da SPA) continuam na #62 e são tomadas na fase em que bloqueiam.

## Quando `docs/agents/architecture.md` muda

O arquivo só muda por ADR. Esta ADR autoriza, cada uma no PR do passo que a
torna verdadeira (nunca antes, para a documentação não descrever pasta que não
existe):

- **A1:** linha de `packages/domain` na tabela "Onde cada coisa mora"
  (`docs/agents/architecture.md:23`) e os caminhos de `commerce`, `finance`
  e `catalog` citados no texto.
- **A2:** os caminhos da API e do banco (`docs/agents/architecture.md:16`) e
  dos arquivos servidos (`docs/agents/architecture.md:62`).
- **Aprovação da ADR-0001** (não desta): a exceção React Native, Metro e
  TypeScript para `apps/mobile` em `docs/agents/architecture.md:10` a `:12` e
  a linha de `apps/mobile` na tabela.

## Consequências

### Positivas

- uma única fonte das regras de comércio e finanças, com teste que falha se
  alguém divergir;
- fronteira clara entre backend e frontends, e o banco fora da pasta servida;
- o mobile nasce com o contrato e o domínio já separados.

### Custos e riscos

- movimentação de arquivos quebra referências de documentação e caminhos de
  teste (mitigado pelo checklist acima e pelo remapeamento versionado);
- a guarda de spec precisa acompanhar as pastas novas, senão para de proteger;
- dois a três PRs só de estrutura, sem entrega visível ao usuário;
- quem tem `src/data/db.json` local precisa migrar o arquivo no passo A2.

## Gate

A ADR está aceita: os passos A1 e A2 estão liberados e **não instalam Expo nem
React Native**, então não dependem da aprovação da ADR-0001. A ADR-0001 segue
como proposta; a Fase 1 do mobile só começa com ela aprovada e com as decisões
restantes do gate respondidas (sessão, distribuição e orçamento da SPA).
