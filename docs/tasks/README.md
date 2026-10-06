# Convenção de tasks

O "o quê" vive como issue do GitHub (criada por `/to-spec` — ver
`docs/agents/issue-tracker.md`). O "como" vive local:

```
docs/tasks/{numero-da-issue}-{slug}/
├── blueprint.md   # copiado de .ai/templates/blueprint-template.md — o "como"
└── meta.json      # estado da task (fase atual, branch, ship)
```

`numero-da-issue` = número da issue no GitHub. `slug` = kebab-case do título.

Task pequena o suficiente para não precisar de issue formal? Use só
`.ai/templates/spec-template.md` localmente e pule a pasta — o pipeline de
`/to-spec` + `/implement` é para o caso comum, não obrigatório para tudo.

## Por que isso existe

As specs curtas em `.ai/specs/` eram rasas demais para servir de grounding
(sem critério de aceite rastreável, sem citar código real). Issue (o quê) +
blueprint (como) resolve isso sem exigir um pipeline pesado.

## meta.json

```json
{
  "issueNumber": 123,
  "slug": "slug",
  "branch": "feat/{numero-da-issue}-{slug}",
  "phase": "blueprint | dev | validacao | ship",
  "ship": { "pr": null }
}
```

Atualize `phase` conforme a task avança. `node .ai/scripts/check-coherence.js`
não valida o conteúdo de `meta.json`, só referências de arquivo — a
consistência de fase é responsabilidade de quem está conduzindo a task.
