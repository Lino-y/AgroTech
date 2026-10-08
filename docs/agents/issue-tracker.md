# Issue tracker: GitHub

Issues e specs deste repo vivem como GitHub issues. Use a CLI `gh` para todas as operações.

## Convenções

- **Criar issue**: `gh issue create --title "..." --body "..."`. Use heredoc para corpo multi-linha.
- **Ler issue**: `gh issue view <number> --comments`, filtrando comentários com `jq` e buscando labels.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` com `--label`/`--state` conforme necessário.
- **Comentar**: `gh issue comment <number> --body "..."`
- **Aplicar/remover label**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`
- **Pegar uma issue** (regra 10, `.ai/rules/10-issue-em-andamento.md`):
  - Pegue só as livres: `gh issue list --search "is:open no:assignee -label:em-andamento"`.
  - Ao começar: `gh issue edit <number> --add-assignee @me --add-label em-andamento`, e comente qual é a branch.
  - Ao pausar ou desistir: `gh issue edit <number> --remove-assignee @me --remove-label em-andamento`, e comente o motivo.

O repo é inferido de `git remote -v`; `gh` já faz isso automaticamente dentro do clone.

## PRs como superfície de triagem

**PRs como superfície de request: não.** _(Mude para sim se PRs externos devem virar feature request; `/triage` — não instalado neste repo — leria essa flag.)_

## Quando uma skill diz "publicar no issue tracker"

Criar uma GitHub issue.

## Quando uma skill diz "buscar o ticket relevante"

Rodar `gh issue view <number> --comments`.

## Relação com `docs/tasks/`

O issue do GitHub (criado por `/to-spec`) é o "o quê" — spec, user stories, critérios.
`docs/tasks/{numero-da-issue}-{slug}/blueprint.md` é o "como" — plano técnico local,
citando `arquivo:linha` real (ver `docs/tasks/README.md`). `/implement` lê os dois:
a issue para o escopo, o blueprint (se existir) para as decisões técnicas já tomadas.
