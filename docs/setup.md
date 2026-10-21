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
- No `.env`: `PORT` (padrão 3001) e `JWT_SECRET` (o comando para gerar um
  está no `.env.example`). Sem `JWT_SECRET` a API sorteia um segredo a cada
  início (`server.js:21`) e o login cai sempre que o servidor reinicia.

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

O banco é o arquivo `src/data/db.json`, fora do git: o `server.js` cria a
partir dos dados de exemplo (`defaultDb`) no primeiro uso, e cadastros,
anúncios e pedidos feitos no app ficam só na sua máquina. Para voltar ao
estado inicial, apague o arquivo e reinicie o servidor.

## 4. Testes e qualidade

| O quê | Comando |
|---|---|
| Testes do app (`tests/`), incluindo os de API, que sobem o `server.js` numa porta livre com um banco temporário (`DATA_FILE`) | `npm test` |
| Testes com barreira de cobertura nativa do Node (linhas 88%, branches 68%, funções 85%) | `npm run test:coverage` |
| Testes de tela no Chrome headless (navegação sem reload, login, catálogo vazio e com erro, drag-to-scroll dos carrosséis), fora do `npm test` e do `verify` | `npm run test:ui` |
| Lint (ESLint, com alerta de função grande ou complexa) | `npm run lint` |
| Lint com orçamento: os 19 avisos legados são aceitos, avisos novos falham | `npm run lint:budget` |
| Tipos (JSDoc nos arquivos com `// @ts-check`) | `npm run typecheck` |
| Verificação completa local antes do push | `npm run verify` |
| Auditoria de dependências com bloqueio em vulnerabilidade alta/crítica | `npm run audit:dependencies` |
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

### Testes de tela (`npm run test:ui`)

- Ficam em `tests/ui/*.ui.js`, nome que o `node --test` padrão não procura:
  por isso não entram no `npm test`, na cobertura nem no `npm run verify`.
  Rode antes de abrir PR que mexa em tela, navegação ou carrossel.
- Precisam de Chrome ou Edge. O script procura nos caminhos de instalação
  padrão do Windows, do macOS e do Linux; fora deles, aponte o executável em
  `CHROME_PATH`. Sem navegador, os testes aparecem como pulados (`skipped`) e
  o comando termina com sucesso.
- Cada arquivo sobe o `server.js` numa porta livre com banco temporário
  (`DATA_FILE`, nunca o `src/data/db.json`) e o Chrome headless com perfil
  temporário, controlado pelo DevTools Protocol com o WebSocket nativo do Node
  22, sem dependência nova. Cada teste abre a SPA numa aba com `localStorage`
  limpo, e a internet fica bloqueada (fontes e fotos externas não carregam).
  A base comum é `tests/ui/browser.js`.
- Conferido em 20/10/2026 no Windows 11, com Chrome 155 e com Edge (via
  `CHROME_PATH`).

```bash
CHROME_PATH="/caminho/do/chrome" npm run test:ui   # só se o navegador estiver fora do caminho padrão
```
