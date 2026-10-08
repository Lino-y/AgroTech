# Regras do fluxo

Regras de processo que o harness aplica ou lembra a cada pedido. A numeração é
a mesma do `mais-frota`, para a mesma regra ter o mesmo número nos dois repos;
as que faltam (01, 03–08) são de arquitetura do domínio de frota e não se
aplicam aqui.

| # | Regra | Onde é cobrada |
|---|-------|----------------|
| 02 | [Toda funcionalidade passa por spec antes da implementação](02-spec-first.md) | `workflow-guide.js` (lembrete), `/to-spec`, `/implement` |
| 09 | [Qualquer mudança em fluxo, regra ou arquitetura deve atualizar a spec correspondente](09-keep-spec-updated.md) | `.ai/scripts/spec-guard.js` no pre-push |
| 10 | [Issue em execução fica sinalizada como em andamento](10-issue-em-andamento.md) | `workflow-guide.js` (lembrete), `/implement` |

Regra nova só entra aqui se nascer de uma decisão real do projeto (ver
`docs/agents/playbook.md` → "Antes de criar `.ai/rules`..."), nunca para
preencher a pasta.
