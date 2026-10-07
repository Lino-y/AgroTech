# Domain Docs

Como as skills de engenharia devem consumir a documentação de domínio deste repo.

## Antes de explorar, leia

- **`CONTEXT.md`** na raiz do repo, se existir.
- **`docs/adr/`**: ADRs que tocam a área que você vai mexer.
- **`.ai/specs/`**: personas, requisitos funcionais e não funcionais do produto.

Se `CONTEXT.md` ou `docs/adr/` não existirem ainda, **prossiga em silêncio** — não sinalize a ausência, não sugira criá-los antecipadamente. A skill `domain-modeling` (acionada via `grill-with-docs`) os cria sob demanda quando um termo/decisão é de fato resolvido.

## Estrutura (single-context)

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

Este repo é single-context (sem sinal de monorepo — sem workspaces, sem `CONTEXT-MAP.md`).

## Use o vocabulário do glossário

Ao nomear um conceito de domínio (título de issue, proposta de refactor, nome de teste), use o termo definido em `CONTEXT.md`. Não crie sinônimo para algo que já tem nome lá.

## Sinalize conflito com ADR

Se a sua saída contradiz uma ADR existente, isso vira um achado explícito, nunca é resolvido em silêncio.
