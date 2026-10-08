# Roteiro: feature nova ou hotfix

Pré-requisito por máquina, uma vez: `gh auth login`, `npm install` na raiz
(instala as dependências e ativa os git hooks de `.githooks/`), instalar o
`rtk` (ver `CLAUDE.md` → Setup obrigatório), aceitar o prompt de confiança do
plugin `ponytail` na primeira sessão neste repo. Detalhes em `docs/setup.md`.

**Vai pegar uma issue que já existe?** Pegue só issue sem responsável e sem a
label `em-andamento`, e marque-a antes de começar. Os comandos estão em
`docs/agents/issue-tracker.md` (regra 10).

## Fluxo A — Feature nova

1. Descreva a feature no chat, em linguagem natural.
2. **Antes de codar**: `git fetch origin && git pull` de `main`/`master` —
   toda implementação começa da master atualizada.
3. **Crie a branch da feature a partir da master atualizada**
   (`feat/{slug}` , `fix/{slug}` ...) — nunca commite direto na master.
4. **Ambíguo ou não-trivial?** `/grill-with-docs` primeiro — interroga até
   fechar o design, atualiza `CONTEXT.md`/`docs/adr/`. Pequeno e claro? pule
   pro passo 5.
5. `/to-spec` — sintetiza a conversa numa spec e publica como GitHub Issue
   (label `ready-for-agent`). Se você mesmo vai implementar, marque a issue
   como em andamento já (assignee + label `em-andamento`, regra 10).
6. **Decisão técnica não-trivial?** Copie
   `.ai/templates/blueprint-template.md` pra
   `docs/tasks/{numero-da-issue}-{slug}/blueprint.md` e preencha, citando
   `arquivo:linha` real (nunca "de memória"). Pule se a implementação for
   direta.
7. `/implement` — implementa a partir da issue (+ blueprint, se existir),
   roda `/tdd` nas costuras.
8. `/spec-code-review main` (ou a branch base) — revisão em 2 eixos
   (Padrões + Spec) antes de fechar.
9. Corrija o que o review achou. Repete 7-8 se necessário.
10. **Antes do PR**: se a master andou durante o desenvolvimento, integre
    (`git fetch origin && git rebase origin/main` ou merge) e resolva
    conflitos localmente, rodando testes antes de reenviar.
11. Commit: sempre Conventional Commits (`feat: ...`) — mensagem fora do
    padrão é barrada automaticamente, e o pre-commit barra erro de ESLint e
    de tipo nos `.js` do commit.
12. Ship: `CONFIRM_SHIP=1 git push origin <branch>` seguido de
    `CONFIRM_SHIP=1 gh pr create --title "..." --body "Closes #<issue>"`.
    O pre-push roda o spec-guard (regra 09): mexeu em `src/`, `server.js` ou
    `index.html` sem atualizar `.ai/specs/` ou `docs/tasks/`? Declare
    `Spec: n/a — <motivo>` no commit ou no PR. **Todo trabalho vai por PR** —
    push/merge direto na master sobrescreve mudanças de outros
    contribuidores.
13. A issue fecha sozinha quando o PR referenciando "Closes #N" for
    mergeado.

## Fluxo B — Hotfix

Mais curto, sem pular a rede de segurança:

1. Descreva o bug + causa raiz suspeitada (se já souber).
2. **Antes de codar**: `git fetch origin && git pull` de `main`/`master` e
   crie branch própria (`fix/{slug}`) — hotfix também nunca vai direto na
   master.
3. Óbvio e pequeno? Pule `/grill-with-docs`. Ainda assim rode `/to-spec`
   (rápido, sem interrogatório) pra deixar rastro no GitHub, e marque a issue
   como em andamento (regra 10).
4. `/tdd` direto na correção (teste que reproduz o bug primeiro).
5. `/spec-code-review main` antes do PR — hotfix também passa pelo eixo de
   Padrões.
6. Commit `fix: ...` (Conventional Commits).
7. Ship: mesmo gate do fluxo A — `CONFIRM_SHIP=1 git push ...` +
   `CONFIRM_SHIP=1 gh pr create ...`.

## Trivial (typo, comentário, 1 linha óbvia)

Ainda assim: pull da master, branch própria (`fix/{slug}`), edite,
`git commit -m "fix: ..."`, `CONFIRM_SHIP=1 git push ...` + PR.
Não force spec/review pra isso: se tocar código, `Spec: n/a — trivial` no
commit basta para o spec-guard. **Push direto na master nunca é permitido.**

## O que roda sem perguntar

Docker, npm/pnpm/node, git local, testes. Push/PR/merge exige
`CONFIRM_SHIP=1` no comando (ver `CLAUDE.md` → Autonomia). Nunca cole uma key
no chat (ver `CLAUDE.md` → Secrets) — diga só o nome da variável.

## O que ainda não existe (não espere que funcione)

- Banco de dados: os dados vivem em `src/data/db.json`, lido e gravado pelo
  `server.js`. O PostgreSQL de `.ai/specs/06-schema-banco-de-dados.md` é alvo,
  não existe.
- CI: não há `.github/workflows/`. O spec-guard só roda no pre-push local, e
  `--no-verify` pula.
- Docker, `.mcp.json`, deploy e staging: nada configurado.
- Labels `ready-for-agent` e `em-andamento`: ainda não existem no GitHub.
  Crie uma vez, antes do primeiro `/to-spec`:
  `gh label create ready-for-agent` e `gh label create em-andamento`.
- Este pipeline (`/to-spec` → `/implement` → `/spec-code-review`) nunca
  rodou de ponta a ponta neste repo. Na primeira vez, espere ajustar.

## Antes de criar `.ai/rules`, `.ai/sensors` ou `.ai/agents`

Esse padrão (regras curtas, definições de métrica, lista de especialidades
técnicas) só vale se nascer de uma decisão real, não de brainstorm tentando
preencher a pasta.

**Nunca peça pra IA gerar isso especulativamente.** Foi assim que o
`dev-harness` original (`mais-frota/catfish`) acabou com documentação
detalhada de um bot de Slack inteiro que nunca foi codado, com "Status:
✅ Implementado e Pronto" — a IA documentou algo plausível pro domínio em
vez de construir, e ninguém percebeu até auditar.

Regra: rode `/grill-with-docs` sobre a decisão real antes de escrever
qualquer arquivo em `.ai/rules|sensors|agents`. Cada arquivo tem que
rastrear a uma decisão que alguém de fato tomou (ver `docs/adr/` gerado pelo
`domain-modeling`).
