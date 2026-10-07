# Setup local

Como deixar o AgroTech rodando na sua máquina. Os comandos foram conferidos
com o `package.json` e o `server.js` em 07/10/2026, no Windows 11 com Node
22.20 e npm 10.9.

## 1. O que instalar (uma vez por máquina)

### Obrigatório

| Ferramenta | Versão | Para quê | Windows | macOS |
|---|---|---|---|---|
| Node.js | 22 LTS (mínimo 20.19 ou 22.13, exigência do ESLint 10) | tudo (`node --watch` e `node --test` são do próprio Node) | `winget install OpenJS.NodeJS.LTS` | `brew install node@22` |
| Git | recente | — | `winget install Git.Git` | `xcode-select --install` |

### Recomendado (fluxo do time)

| Ferramenta | Para quê | Instalação |
|---|---|---|
| GitHub CLI (`gh`) | issues e PRs do fluxo spec → PR (`docs/agents/playbook.md`) | `winget install GitHub.cli` / `brew install gh`, depois `gh auth login` |
| rtk | corta tokens nas sessões de IA (ver `CLAUDE.md`) | `winget install rtk-ai.rtk` / `brew install rtk` |
| Claude Code | hooks e skills do repo (`.claude/`) e o plugin ponytail | na primeira sessão, aceite a marketplace `ponytail` (já declarada em `.claude/settings.json`) |
| ponytail fora do Claude Code | regras de "menor código que resolve" (YAGNI, reuso, menor diff) | o Codex e as outras ferramentas que leem `AGENTS.md` já recebem as regras. Para ter também os comandos `/ponytail-*` no Codex: `codex plugin marketplace add DietrichGebert/ponytail` e depois `codex plugin add ponytail@ponytail` |

## 2. Primeira vez

```bash
git clone https://github.com/Lino-y/AgroTech.git && cd AgroTech
npm install
cp .env.example .env
```

- O `npm install` também ativa os git hooks (`.githooks/`, pelo script
  `prepare`). Confira com `git config core.hooksPath`, que deve responder
  `.githooks`.
- No `.env`: `PORT` (padrão 3001) e `JWT_SECRET`. Sem `JWT_SECRET` a API
  assina os tokens com um segredo fixo de desenvolvimento (`server.js:16`);
  defina um valor seu.

## 3. Rodar

| Comando (na raiz) | Sobe | Endereço |
|---|---|---|
| `npm start` | API Express, que também serve o front (`index.html` e `src/`) | http://localhost:3001 (`GET /api/health`) |
| `npm run dev` | o mesmo, reiniciando a cada mudança (`node --watch`) | idem |

Usuários de exemplo (o `server.js` recria os dois se faltarem no banco):

| Perfil | E-mail | Senha |
|---|---|---|
| Produtor | `demo@agrotech.com.br` | `demo123` |
| Admin | `admin@agrotech.com.br` | `admin123` |

O banco é o arquivo `src/data/db.json`, versionado. Cadastros, anúncios e
pedidos feitos no app são gravados nele, e no Windows o primeiro acesso já
regrava o arquivo (o conteúdo fica igual, só o fim de linha muda). Rode
`git diff src/data/db.json` antes de commitar para não versionar dado de
teste.

## 4. Testes e qualidade

| O quê | Comando |
|---|---|
| Testes do app (`tests/`) | `npm test` |
| Lint (ESLint, com alerta de função grande ou complexa) | `npm run lint` |
| Tipos (JSDoc nos arquivos com `// @ts-check`) | `npm run typecheck` |
| Governança (spec-guard e workflow-guide) | `node --test .ai/scripts/spec-guard.test.js .claude/hooks/workflow-guide.test.js` |
| Referências de arquivo quebradas na doc | `npm run check:coherence` |

- O `npm test` só encontra `tests/`, porque o `node --test` não entra em
  pastas que começam com ponto. Por isso os testes de governança têm comando
  próprio.
- O pre-commit roda o ESLint e o `tsc` nos `.js` do commit: erro barra, aviso
  (complexidade, dívida antiga) só alerta.
- A checagem de tipos vale para os arquivos que começam com `// @ts-check`
  (hoje `src/services/cart.js` e `src/services/commerce.js`). Arquivo novo em
  `src/services/` entra do mesmo jeito (`docs/agents/architecture.md`).
