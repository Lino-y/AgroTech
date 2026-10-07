# AgroTech

Plataforma mobile-first de e-commerce e gestão financeira para o agronegócio
(compra de insumos pelo Comprador Rural, anúncios do Vendedor Agro): SPA em
JavaScript puro servida por uma API Express, com os dados em
`src/data/db.json`.

Guia do projeto: `README.md` (estrutura) e `docs/setup.md` (instalar, rodar,
testar). Specs do produto: `.ai/specs/`. Convenção de task (spec + blueprint
+ estado): `docs/tasks/README.md`. Regras do fluxo: `.ai/rules/README.md`.

Arquitetura e padrões de código, obrigatórios antes de codar:
@docs/agents/architecture.md

## Como pedir uma feature ou hotfix pelo prompt

Roteiro passo a passo (o que digitar, em que ordem, o que é opcional):
`docs/agents/playbook.md`.

## Agent skills

### Issue tracker

GitHub Issues via `gh` CLI. Ver `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` na raiz, criados sob demanda pelo
`domain-modeling` (nunca antecipadamente). Ver `docs/agents/domain.md`.

## Autonomia (o que pode rodar sem perguntar)

Livre: `docker compose`, `npm`/`pnpm`/`node`/`npx`, git local (`status`,
`diff`, `log`, `add`, `commit`, `branch`, `checkout`, `fetch`, `pull`),
testes (`npm test`, `node --test`).

Exige `CONFIRM_SHIP=1` explícito no comando (`.claude/hooks/ship-gate.js`):
`git push`, `gh pr create`, `gh pr merge`. Force-push em `main`/`master`
nunca é permitido, mesmo com `CONFIRM_SHIP=1`.

Nunca (sem opção de override — `.claude/hooks/destructive-guard.js`):
`docker system prune`/`volume rm`, apagar `.git`, `DROP`/`TRUNCATE`, editar
`.env*` (exceto `.env.example`), `.mcp.json` ou `.github/workflows/*`.

Todo `git commit` passa por Conventional Commits
(`.claude/hooks/conventional-commit.js`) e scan de segredo no diff staged
(`.claude/hooks/secret-scan.js`). Commit direto e push para `main`/`master`
são bloqueados pelos git hooks (`.githooks/`), que valem para qualquer
ferramenta — crie a branch primeiro. O pre-commit também barra erro de
ESLint e de tipo (JSDoc) nos `.js` do commit (`npm run lint`,
`npm run typecheck`).

## Fluxo obrigatório de implementação (evitar sobrescrição de código)

1. **Antes de iniciar qualquer implementação**: rode `git pull` de
   `main`/`master` (com `git fetch` antes) para garantir que está trabalhando
   sobre a versão mais recente do código. Se houver mudanças locais não
   commitadas, commite-as numa branch antes do pull (`git stash` só se o
   usuário pedir).
2. **Nunca commite direto em `main`/`master`**: todo commit deve ser criado
   numa branch dedicada (`feat/{slug}`, `fix/{slug}`, `docs/{slug}` ...)
   criada a partir da master atualizada. Isto é bloqueado pelo
   `.githooks/pre-commit`.
3. **Sinalize a issue em andamento antes de codar**: rode `gh issue edit <n>
   --add-assignee @me --add-label em-andamento` e comente qual é a branch. Só
   pegue issue sem responsável e sem `em-andamento`; ao pausar ou desistir,
   libere-a (regra 10, `.ai/rules/10-issue-em-andamento.md`).
4. **Toda branch gera uma Pull Request**: ao final da implementação,
   `CONFIRM_SHIP=1 git push origin <branch>` + `CONFIRM_SHIP=1 gh pr create`
   (ver `docs/agents/playbook.md`). Nunca faça push/merge direto na master —
   isso sobrescreve mudanças de outros contribuidores.
5. **Antes do PR**: se a master andou durante o desenvolvimento, integre
   (`git fetch origin && git rebase origin/main` ou merge) e resolva conflitos
   localmente, rodando testes antes de reenviar.

## Anti-alucinação

- Nenhuma feature começa sem spec aprovada: issue do GitHub (`/to-spec`) para
  o "o quê" + `docs/tasks/{numero-da-issue}-{slug}/blueprint.md` para o
  "como" (template em `.ai/templates/blueprint-template.md`).
- Toda decisão técnica no blueprint cita `arquivo:linha` de código real já
  lido, ou está marcada `[NOVO]`. Nunca descrever schema/código "de
  memória".
- Fonte de verdade em divergência: spec manda no "o quê", blueprint manda no
  "como". Divergência encontrada vira item registrado no blueprint, nunca é
  resolvida em silêncio.
- Antes de codar contra os dados: o banco hoje é o arquivo
  `src/data/db.json`, lido e gravado pelo `server.js` (`readDb`/`writeDb`).
  O PostgreSQL de `.ai/specs/06-schema-banco-de-dados.md` e a API de
  `.ai/specs/05-openapi-spec.md` descrevem o alvo, não o que existe — confira
  no código antes de assumir estrutura.
- `node .ai/scripts/check-coherence.js` para validar que a documentação em
  `.ai/`, `docs/` e `.claude/` não tem referência de arquivo quebrada.
- Guardas que valem para qualquer ferramenta (git hooks em `.githooks/` +
  `.ai/scripts/spec-guard.js`): ver `AGENTS.md`. Aqui, além delas,
  `.claude/hooks/workflow-guide.js` injeta o fluxo a cada pedido de
  implementação.

## Secrets

Nunca cole o valor de uma key/token nesta conversa — o chat em si já conta
como vazamento (fica no transcript da sessão). Fluxo correto:

1. Copie `.env.example` para `.env` e preencha os valores você mesmo, no seu
   editor/terminal, fora do chat.
2. Me diga só o **nome** da variável (ex: "configurei JWT_SECRET no .env").
   Scripts leem `process.env` em runtime, eu não preciso ver o valor.
3. Eu não consigo editar `.env` mesmo se pedirem (`destructive-guard.js`
   bloqueia), e `secret-in-prompt.js` bloqueia e avisa se uma mensagem sua
   parecer conter uma credencial real — mas se isso disparar, considere a key
   comprometida e rotacione.

## Integrações

- GitHub via `gh` CLI (push/PR sempre atrás do gate acima). As labels do
  fluxo (`ready-for-agent`, `em-andamento`) ainda não existem no repo — ver
  `docs/agents/playbook.md` → "O que ainda não existe".
- Banco: nenhum serviço; os dados vivem em `src/data/db.json`. O PostgreSQL
  da spec 06 ainda não foi decidido nem implementado.
- Deploy: ainda não decidido — não configurar antes de precisar.

## Setup obrigatório pra quem clonar este repo

- **git hooks**: `npm install` na raiz ativa `.githooks/` (script `prepare`).
  Sem isso, nada barra commit na `main` fora do Claude Code.
- **ponytail**: já declarado neste projeto (`.claude/settings.json` →
  `extraKnownMarketplaces`/`enabledPlugins`). O Claude Code vai pedir pra
  confiar na marketplace externa na primeira sessão — é esperado, aceite.
- **rtk**: o binário não vem pelo git, precisa instalar uma vez por máquina:
  `winget install rtk-ai.rtk` (Windows) ou `brew install rtk` (mac/Linux).
  Depois disso as instruções de `RTK.md`, importadas abaixo, valem pra
  qualquer sessão neste repo.

@RTK.md
