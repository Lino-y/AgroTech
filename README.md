# AgroTech

## Visão geral

Plataforma mobile-first de e-commerce e gestão financeira voltada ao
agronegócio (`.ai/specs/01-visao-geral-e-personas.md`):

- **Comprador Rural**: compra insumos e controla as finanças da fazenda.
- **Vendedor Agro**: anuncia máquinas, rações, fertilizantes e animais.

Fluxos principais (RF01–RF06 em `.ai/specs/02-requisitos-funcionais.md`):
cadastro com perfil, catálogo com busca e filtros, carrinho com cupons e
frete grátis, checkout (Pix, cartão, boleto), rastreio do pedido em 4
estágios e chatbot de suporte.

## Estado atual do repositório

SPA em JavaScript puro (módulos ES, sem build) servida por uma API Express
(`server.js`), que também guarda os dados no arquivo `src/data/db.json`.
Para instalar e rodar, veja [`docs/setup.md`](docs/setup.md).

As specs em `.ai/specs/` também descrevem o *alvo*: o schema PostgreSQL
(`06`) e a API OpenAPI (`05`) ainda não existem como descritos. Antes de
assumir que algo foi implementado, confira no código.

## Stack

- Front: HTML + CSS (design tokens em `src/styles/tokens.css`) + JavaScript
  puro em módulos ES
- API: Node.js + Express 4, autenticação JWT (`jsonwebtoken`) e senhas com
  bcrypt (`bcryptjs`)
- Dados: arquivo JSON (`src/data/db.json`)
- Testes: `node:test`, nativo do Node
- Qualidade: ESLint 10 e TypeScript 7 só como checador de JSDoc (sem build)

## Estrutura do repositório

```text
AgroTech/
├─ index.html             # entrada da SPA (carrega src/modules/catalog.js)
├─ server.js              # API Express (/api/*) e servidor dos arquivos do front
├─ eslint.config.js       # lint: erro barra o commit, complexidade só avisa
├─ jsconfig.json          # checagem de tipos por JSDoc (arquivos com // @ts-check)
├─ src/
│  ├─ modules/            # telas e fluxos: catálogo, carrinho, auth, rastreio, suporte
│  ├─ services/           # regras de negócio e acesso à API (cart, catalog, commerce...)
│  ├─ components/         # Navbar, ProductCard, FinanceChart
│  ├─ styles/             # tokens.css (design tokens) e ui.css
│  └─ data/db.json        # "banco" em arquivo, fora do git (criado pelo server.js no 1º uso)
├─ assets/                # logo
├─ tests/                 # testes do app (npm test)
├─ docs/
│  ├─ setup.md            # instalação e execução local
│  ├─ agents/             # playbook, arquitetura, issue tracker e domínio (fluxo com IA)
│  └─ tasks/              # blueprints por issue (o "como")
├─ .ai/
│  ├─ specs/              # specs do produto: visão, RF/RNF, arquitetura, API, schema, tasklist
│  ├─ rules/              # regras do fluxo (02, 09, 10)
│  ├─ skills/             # competências técnicas do domínio
│  ├─ templates/          # templates de spec e blueprint
│  └─ scripts/            # spec-guard (pre-push) e check-coherence
├─ .claude/               # hooks, skills e settings do Claude Code
├─ .githooks/             # pre-commit, commit-msg e pre-push (qualquer ferramenta)
├─ .github/               # templates de issue e de PR
├─ CLAUDE.md, AGENTS.md   # regras para agentes (Claude Code; Codex e outros)
└─ package.json           # scripts start, dev, test, lint, typecheck, check:coherence e prepare
```

## Como contribuir

Todo trabalho nasce de uma spec e chega por PR — roteiro em
[`docs/agents/playbook.md`](docs/agents/playbook.md). Commit direto na `main`
é bloqueado pelos git hooks, ativados pelo `npm install`.
