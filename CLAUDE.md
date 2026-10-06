# {{NOME_DO_PROJETO}}

{{Uma frase sobre o que este projeto é.}}

## Como pedir uma feature ou hotfix pelo prompt

Roteiro passo a passo: `docs/agents/playbook.md`.

## Autonomia (o que pode rodar sem perguntar)

Livre: `docker compose`, `npm`/`pnpm`/`node`/`npx`, git local (`status`,
`diff`, `log`, `add`, `commit`, `branch`, `checkout`, `fetch`, `pull`),
testes. {{Adicione aqui as CLIs específicas do seu stack (ex: supabase,
aws, terraform) e libere em `.claude/settings.json` → `permissions.allow`.}}

Exige `CONFIRM_SHIP=1` explícito no comando (`.claude/hooks/ship-gate.js`):
`git push`, `gh pr create`, `gh pr merge`. Force-push em `main`/`master`
nunca é permitido, mesmo com `CONFIRM_SHIP=1`.

Nunca (sem opção de override — `.claude/hooks/destructive-guard.js`):
`docker system prune`/`volume rm`, apagar `.git`, comando SQL destrutivo
(DROP/TRUNCATE) num cliente de banco, editar `.env*` (exceto
`.env.example`), `.mcp.json` ou `.github/workflows/*`.

Todo `git commit` passa por Conventional Commits
(`.claude/hooks/conventional-commit.js`) e scan de segredo no diff staged
(`.claude/hooks/secret-scan.js`).

## Anti-alucinação

- Nenhuma feature começa sem spec aprovada: issue do GitHub (`/to-spec`)
  para o "o quê" + `docs/tasks/{numero-da-issue}-{slug}/blueprint.md` para
  o "como" (template em `.ai/templates/blueprint-template.md`).
- Toda decisão técnica no blueprint cita `arquivo:linha` de código real já
  lido, ou está marcada `[NOVO]`. Nunca descrever schema/código "de
  memória".
- Fonte de verdade em divergência: spec manda no "o quê", blueprint manda
  no "como". Divergência encontrada vira item registrado no blueprint,
  nunca é resolvida em silêncio.
- `node .ai/scripts/check-coherence.js` para validar que a documentação em
  `.ai/`, `docs/` e `.claude/` não tem referência de arquivo quebrada.

## Secrets

Nunca cole o valor de uma key/token nesta conversa — o chat em si já conta
como vazamento (fica no transcript da sessão). Fluxo correto:

1. Copie `.env.example` para `.env` e preencha os valores você mesmo, no
   seu editor/terminal, fora do chat.
2. Me diga só o **nome** da variável. Scripts leem `process.env` em
   runtime, eu não preciso ver o valor.
3. Eu não consigo editar `.env` mesmo se pedirem (`destructive-guard.js`
   bloqueia), e `secret-in-prompt.js` bloqueia e avisa se uma mensagem sua
   parecer conter uma credencial real — mas se isso disparar, considere a
   key comprometida e rotacione.

## Integrações

{{Liste aqui: GitHub via gh CLI (push/PR sempre atrás do gate acima), e
qualquer outro serviço (banco, deploy, etc.) com o status real —
configurado, pendente, ou decisão em aberto.}}

## Instruções Adicionais

Verifique se há instruções adicionais de especificação e execução no guia do projeto.
