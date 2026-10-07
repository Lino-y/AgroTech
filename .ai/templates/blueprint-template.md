# Blueprint: {título da task}

> Preencher depois da spec (`.ai/templates/spec-template.md`) estar aprovada.
> Regra de ouro: toda decisão técnica abaixo cita `arquivo:linha` de código
> real já lido, ou está marcada como `[NOVO]`. Nunca descrever estrutura de
> código/banco "de memória" — se precisar, leia o arquivo (os dados vivem
> hoje em `src/data/db.json`, via `server.js`) antes de escrever aqui.

## 1. Dor do usuário

O que motiva essa mudança, em 1-2 frases.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | | | 🔴 | |
| CA02 | | | 🔴 | |

Status: ✅ feito · 🟡 parcial · ⚠️ divergente · 🔴 não feito. Todo critério nasce
🔴; só vira ✅ com evidência (`arquivo:linha` do código + teste que cobre).

## 3. Contratos (antes do código)

Fechados e revisados antes de `/implement`: os testes são escritos contra
eles. Apague o que não se aplica (ver `docs/agents/architecture.md`).

- Endpoint: `MÉTODO /api/...` — auth: nenhuma | `authenticate` | `requireAdmin`
  — request: `{ ... }` — response: `{ ... }` — erros: `4xx { message }`.
  Atualizar `.ai/specs/05-openapi-spec.md` no mesmo PR.
- Dado novo/alterado em `src/data/db.json`: formato do objeto e valor padrão.
- Função pública em `src/services/`: assinatura em JSDoc
  (`@param`/`@returns`), em arquivo com `// @ts-check`.
- Teste que prova cada critério da seção 2, inclusive os limites:
  `tests/<arquivo>.test.js` — nome do caso.

## 4. Decisões técnicas

- Decisão: — Ref: `arquivo:linha` ou `[NOVO]`
- Decisão: — Ref: `arquivo:linha` ou `[NOVO]`

## 5. Must have

Todo item nasce `[ ]`. Só marque `[x]` no commit que o implementa, com a
evidência no próprio item (`arquivo:linha` + teste).

- [ ]
- [ ]

## 6. Nice to have

- [ ]

## 7. Fonte de verdade em caso de divergência

Se este Blueprint divergir do PRD/spec: o **PRD manda no "o quê"** (escopo,
critérios de aceite); este documento manda só no "como" (arquitetura,
implementação). Divergência encontrada durante a implementação vira um item
na seção abaixo, nunca é resolvida em silêncio.

## 8. Divergências / achados durante a implementação

- (preencher conforme aparecer)
