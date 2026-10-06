# Roteiro: feature nova ou hotfix

Pré-requisito por máquina, uma vez: `gh auth login`. Se for usar `rtk` e/ou
`ponytail`, ver `README.md` deste template.

## Fluxo A — Feature nova

1. Descreva a feature no chat, em linguagem natural.
2. **Ambíguo ou não-trivial?** `/grill-with-docs` primeiro — interroga até
   fechar o design, atualiza `CONTEXT.md`/`docs/adr/`. Pequeno e claro? pule
   pro passo 3.
3. `/to-spec` — sintetiza a conversa numa spec e publica como GitHub Issue
   (label `ready-for-agent`).
4. **Decisão técnica não-trivial?** Copie
   `.ai/templates/blueprint-template.md` pra
   `docs/tasks/{numero-da-issue}-{slug}/blueprint.md` e preencha, citando
   `arquivo:linha` real (nunca "de memória"). Pule se a implementação for
   direta.
5. `/implement` — implementa a partir da issue (+ blueprint, se existir),
   roda `/tdd` nas costuras.
6. `/spec-code-review main` (ou a branch base) — revisão em 2 eixos
   (Padrões + Spec) antes de fechar.
7. Corrija o que o review achou. Repita 5-6 se necessário.
8. Commit: sempre Conventional Commits (`feat: ...`) — mensagem fora do
   padrão é barrada automaticamente.
9. Ship: `CONFIRM_SHIP=1 git push origin <branch>` seguido de
   `CONFIRM_SHIP=1 gh pr create --title "..." --body "Closes #<issue>"`.
10. A issue fecha sozinha quando o PR referenciando "Closes #N" for
    mergeado.

## Fluxo B — Hotfix

Mais curto, sem pular a rede de segurança:

1. Descreva o bug + causa raiz suspeitada (se já souber).
2. Óbvio e pequeno? Pule `/grill-with-docs`. Ainda assim rode `/to-spec`
   (rápido, sem interrogatório) pra deixar rastro no GitHub.
3. `/tdd` direto na correção (teste que reproduz o bug primeiro).
4. `/spec-code-review main` antes do PR — hotfix também passa pelo eixo de
   Padrões.
5. Commit `fix: ...` (Conventional Commits).
6. Ship: mesmo gate do fluxo A — `CONFIRM_SHIP=1 git push ...` +
   `CONFIRM_SHIP=1 gh pr create ...`.

## Trivial (typo, comentário, 1 linha óbvia)

Pule tudo: edite, `git commit -m "fix: ..."`, `CONFIRM_SHIP=1 git push ...`.
Não force spec/review pra isso.

## O que roda sem perguntar

Docker, npm/pnpm/node, git local, testes. Push/PR/merge exige
`CONFIRM_SHIP=1` no comando (ver `CLAUDE.md`/`AGENTS.md` → Autonomia).
Nunca cole uma key no chat (ver `CLAUDE.md`/`AGENTS.md` → Secrets) — diga
só o nome da variável.

## Antes de criar `.ai/rules`, `.ai/sensors` ou `.ai/agents`

Esse padrão (regras arquiteturais curtas, definições de métrica, lista de
especialidades técnicas) é útil pra qualquer tema de projeto — mas só se
nascer de uma decisão real, não de brainstorm genérico tentando preencher
a pasta.

**Nunca peça pra IA gerar isso especulativamente.** Foi assim que o
`dev-harness` original (`mais-frota/catfish`) acabou com documentação
detalhada de um bot de Slack inteiro que nunca foi codado, com "Status:
✅ Implementado e Pronto" — a IA documentou algo plausível pro domínio em
vez de construir, e ninguém percebeu até auditar.

Regra: rode `/grill-with-docs` sobre a decisão de arquitetura real antes
de escrever qualquer arquivo em `.ai/rules|sensors|agents`. Cada arquivo
tem que rastrear a uma decisão que alguém de fato tomou (ver `docs/adr/`
gerado pelo `domain-modeling`), nunca a uma suposição sobre "o que esse
tipo de projeto provavelmente precisa".

## Preencha para o seu projeto

Depois de instanciar este template, adicione aqui uma seção "O que ainda
não existe" listando o que este roteiro assume mas seu projeto ainda não
tem (ex: banco, CI, ambiente de staging) — evita que alguém assuma que
algo funciona só porque está documentado.
