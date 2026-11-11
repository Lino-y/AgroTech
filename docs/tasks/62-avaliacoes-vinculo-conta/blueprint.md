# Blueprint: avaliações saem junto com a conta excluída (#62)

Spec: issue #62 (pré-requisitos de backend do app). Esta é a parte de avaliações da exclusão de conta
(`DELETE /api/auth/me`, PR #71), aprovada na conversa: "fazer a mudança".

## 1. Dor do usuário

Quem exclui a conta continuava aparecendo nas avaliações de produtos de outras pessoas, e a nota
dos produtos contava avaliações de uma conta que já não existia.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|----------------|--------|-----------|
| CA01 | A avaliação feita pela conta excluída sai do produto, e a nota e o total são recalculados | teste de API | ✅ | `tests/account-delete-reviews.test.js:73`, `apps/api/server.js:443`, `apps/api/server.js:474` |
| CA02 | Outra conta com o mesmo nome mantém a avaliação dela: o vínculo é o e-mail, não o nome | teste de API | ✅ | `tests/account-delete-reviews.test.js:92` |
| CA03 | Avaliação sem vínculo (seed ou anterior ao vínculo) fica, e produto sem avaliação da conta não muda | teste de API | ✅ | `tests/account-delete-reviews.test.js:105` |
| CA04 | A spec 05 descreve o que sai e o que fica | revisão | ✅ | `.ai/specs/05-openapi-spec.md:160` |

## 3. Contratos (antes do código)

- Vínculo: a avaliação já grava `authorEmail` com o e-mail de quem avaliou (`apps/api/server.js:599`).
  Nenhum campo novo; nenhum dado novo na resposta.
- Recalculo: mesma fórmula da rota de excluir avaliação (`reviewsCount` = número de comentários,
  `rating` = média com uma casa, ou 0 sem comentário).
- Spec 05: a entrada de `DELETE /api/auth/me` passa a dizer que as avaliações com vínculo saem.

## 4. Decisões técnicas

- **Vínculo por e-mail, não por nome.** Dois usuários podem ter o mesmo nome.
- **Sem migração do seed nem de avaliações antigas.** Avaliação sem `authorEmail` não tem como ser
  ligada a uma conta; tentar casar pelo nome seria errado. Fica como está.
- **Função à parte (`dropReviewsOf`)** para não subir a complexidade da rota de exclusão (limite 15 do
  lint). A rota continua com o mesmo número de avisos (18).

## 5. Must have

- CA01 a CA04 acima, com teste que falha antes da mudança.

## 6. Nice to have

- Nada nesta entrega.

## 7. Fonte de verdade em caso de divergência

A spec 05 manda no contrato da API; este blueprint manda no "como".

## 8. Divergências / achados durante a implementação

- **O `GET /api/products` expõe `authorEmail` de cada avaliador** (`apps/api/server.js`, rota
  `app.get('/api/products'`), e o `ownerEmail` dos produtos também. A lista é pública. Isso não faz
  parte desta entrega: é um vazamento de dado pessoal que precisa de decisão própria (remover o campo
  da resposta pública quebra o que depende de `ownerEmail`, como "Minha Loja"). Registrado para o dono
  decidir.
- **Avaliações antigas e do seed não podem ser removidas com segurança**: não têm vínculo. O nome do
  autor delas continua público.
- A nota dos produtos do seed não bate com o número de comentários (ex.: `reviewsCount` 32 com 2
  comentários). A recalculação só toca produtos onde a conta tinha avaliação, então o seed só muda se
  a conta excluída tiver avaliado ali.
