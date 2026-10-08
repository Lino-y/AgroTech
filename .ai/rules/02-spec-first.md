# Rule 02 — Toda funcionalidade passa por spec antes da implementação

## Objetivo

Garantir que toda funcionalidade está bem documentada, escopo definido e requisitos claros antes de qualquer implementação.

## Descrição

Nenhuma linha de código deve ser escrita sem uma spec validada: a issue do GitHub (criada por `/to-spec`) diz o "o quê", e `docs/tasks/{n}-{slug}/blueprint.md` diz o "como" quando a decisão técnica não é óbvia. As specs de produto em `.ai/specs/` (personas, RF/RNF) são o contexto de onde a issue nasce, não substituem os critérios de aceite dela.

## Quando aplicar

- Antes de criar uma tarefa de desenvolvimento
- Ao receber uma demanda nova
- Ao descobrir requisitos não documentados

## Como validar

- Existe issue com objetivo, escopo e critérios de aceite testáveis
- O blueprint, se existir, cita `arquivo:linha` real ou `[NOVO]` em cada decisão
- Dependências e riscos foram mapeados

## Consequência de não seguir

- Ambiguidade no escopo
- Retrabalho e iterações infinitas
- Falta de rastreabilidade
- Dificuldade em QA e validação
