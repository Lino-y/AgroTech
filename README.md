# dev-harness (template)

Harness de desenvolvimento genérico, extraído do projeto `mais-frota/catfish`
depois de validado ao vivo lá: hooks de governança + pipeline de skills
spec-driven + roteiro de implementação. Sem nada específico de domínio —
copie pra qualquer app novo, independente do tema/stack.

## O que tem aqui

- `.claude/hooks/` — 5 hooks (`ship-gate`, `destructive-guard`,
  `conventional-commit`, `secret-scan`, `secret-in-prompt`) que bloqueiam
  push/PR sem confirmação, ações destrutivas e segredo vazando pro chat ou
  pro commit.
- `.claude/skills/` — pipeline `to-spec` → `implement` → `tdd` →
  `spec-code-review`, mais `grill-with-docs`/`grilling`/`domain-modeling`
  (de [mattpocock/skills](https://github.com/mattpocock/skills),
  descrições em PT-BR) e `setup-matt-pocock-skills` (configura o repo).
- `.claude/settings.json` — permissões de autonomia + hooks já ligados.
- `docs/agents/playbook.md` — roteiro passo a passo de feature/hotfix.
- `docs/tasks/README.md`, `.ai/templates/{blueprint,spec}-template.md` —
  convenção de spec (issue do GitHub) + blueprint local citando
  `arquivo:linha` real.
- `.ai/scripts/check-coherence.js` — checa referência de arquivo quebrada
  em `.ai/`, `docs/`, `.claude/`, `.github/`.
- `CLAUDE.md` / `AGENTS.md` — esqueletos com `{{placeholders}}` pra
  preencher por projeto.
- `.gitignore` — protege `.env`, ignora node_modules/build/etc.

## Como instanciar num projeto novo

1. Copie todo o conteúdo desta pasta pra raiz do projeto novo (não
   sobrescreva um `README.md`/`.gitignore` já existente sem checar antes).
2. Preencha os `{{placeholders}}` em `CLAUDE.md` e `AGENTS.md` (nome do
   projeto, stack, integrações reais).
3. Ajuste `.claude/settings.json` → `permissions.allow`: adicione as CLIs
   do stack real (ex: `Bash(supabase:*)`, `Bash(aws:*)`, `Bash(jest:*)`).
4. `gh auth login` (uma vez por máquina, se ainda não estiver logado).
5. Dentro do Claude Code, no projeto novo: rode `/setup-matt-pocock-skills`
   — ele detecta o remote do GitHub e configura `docs/agents/*.md`
   sozinho.
6. Se quiser `rtk` (economia de token): `rtk init` (Claude) e/ou
   `rtk init --codex` (Codex) — precisa do binário instalado primeiro
   (`winget install rtk-ai.rtk` no Windows).
7. Se quiser o plugin `ponytail` em escopo de projeto:
   ```
   claude plugin marketplace add https://github.com/DietrichGebert/ponytail.git --scope project
   claude plugin install ponytail@ponytail --scope project
   ```
8. Rode `node .ai/scripts/check-coherence.js` pra confirmar que nada ficou
   quebrado antes do primeiro commit. Antes do passo 5 (`/setup-matt-pocock-skills`),
   ele vai acusar 5 referências a `docs/agents/issue-tracker.md`/`domain.md`
   — é esperado, somem depois de rodar o setup.
9. Complete `docs/agents/playbook.md` com uma seção "O que ainda não
   existe" específica desse projeto (banco, CI, staging, etc.).

## O que NÃO trouxe de propósito

O `.ai/` original do catfish (agents/roles/rules/sensors/workflows) não
está aqui — era scaffold específico de domínio (fleet management) ou
redundante com o que já está neste template. Não recrie esse volume de
documentação sem uso real por trás; adicione `.ai/rules`/`.ai/sensors`
próprios só se o projeto novo realmente precisar, um de cada vez.
