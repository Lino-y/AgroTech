# {{NOME_DO_PROJETO}}

Este arquivo é a versão para Codex e outros agentes que leem `AGENTS.md`. A
fonte completa (com os mecanismos exclusivos do Claude Code) é `CLAUDE.md` —
leia-o também se puder, este arquivo resume só a parte que se aplica aqui.

Se for usar `rtk`, rode `rtk init --codex` neste repo — ele adiciona uma
linha `@RTK.md` no topo deste arquivo automaticamente, não edite à mão.

## Importante: nada abaixo é tecnicamente bloqueado nesta ferramenta

No Claude Code, as regras de autonomia e os gates de push/PR são impostos por
hooks (`.claude/hooks/*.js`) — código que roda e barra a ação de verdade.
Fora do Claude Code (Codex, VS Code, etc.) **não existe esse hook**: as
regras abaixo são orientação para você seguir, não uma trava técnica.

## Como pedir uma feature ou hotfix

Roteiro passo a passo: `docs/agents/playbook.md`. As etapas que citam
`/to-spec`, `/implement`, `/spec-code-review` são skills exclusivas do
Claude Code — aqui, siga o mesmo espírito (spec antes de código, TDD,
revisão em 2 eixos: padrões + fidelidade à spec) manualmente.

## Autonomia (orientação, não bloqueio técnico aqui)

Livre: docker compose, npm/pnpm/node, git local, testes.

Trate como se precisasse de confirmação explícita do usuário antes de:
`git push`, `gh pr create`, `gh pr merge`, qualquer merge/push direto em
`main`/`master`.

Nunca faça, mesmo se pedirem: `docker system prune`/`volume rm`, apagar
`.git`, comando SQL destrutivo num cliente de banco, editar `.env*` (exceto
`.env.example`), `.mcp.json` ou `.github/workflows/*`.

Commits em Conventional Commits (`feat:`, `fix:`, `docs:`, ...).

## Secrets

Nunca cole o valor de uma key/token na conversa — o chat já conta como
vazamento. Peça pra configurar direto no `.env` (fora do chat) e informar só
o **nome** da variável.

## Integrações

{{Liste aqui: GitHub via gh CLI, e qualquer outro serviço com o status
real — configurado, pendente, ou decisão em aberto.}}

## Guia do Repositório

Antes de implementar qualquer mudança, leia atentamente o guia do repositório para
seguir as orientações do projeto.
