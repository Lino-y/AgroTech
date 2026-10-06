---
description: Verifica referências quebradas entre docs de .ai/, docs/ e .claude/
---

Rode `node .ai/scripts/check-coherence.js` e reporte o resultado ao usuário.

Se houver referências quebradas, para cada uma decida se:
1. o arquivo referenciado foi renomeado/movido → atualize a referência no arquivo de origem, ou
2. o arquivo referenciado nunca existiu ou foi removido de propósito → remova a referência.

Não corrija nada sem confirmar com o usuário se a referência aponta para algo que parece um recurso planejado mas ainda não criado.
