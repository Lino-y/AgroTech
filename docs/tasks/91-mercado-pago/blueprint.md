# Blueprint: Mercado Pago, parte 1 (API dos pedidos)

Spec: `.ai/specs/10-pagamentos-mercado-pago.md` (issue #91). Esta parte cobre a API dos pedidos:

| Coberto agora | Fica para depois |
|---|---|
| RF-01 (OAuth do vendedor), RF-02 (servidor), RF-03, RF-04, RF-05, RF-07 e o extrato do RF-09 | estorno pelo ADMIN (RF-08) |
| | telas da web e do app (parte 3) |
| | patrocínio pago (RF-06): depende das `sponsorships` da spec 09, que ainda não existem |

## 1. Dor do usuário

O pedido nasce "Pedido Confirmado" sem dinheiro ter entrado (`apps/api/server.js:895`, na `main`). O
comprador precisa pagar de verdade, e o vendedor precisa receber direto do Mercado Pago, com a comissão
da AgroTech descontada.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Status | Evidência |
|----|----------|--------|-----------|
| CA01 | Sem `MP_*`, nada muda (modo simulado); configuração pela metade não sobe | ✅ | `apps/api/mercadopago.js:18`, `apps/api/server.js:67`; `tests/payments-api.test.js` "configurado pela metade"; suíte antiga verde (345/345) |
| CA02 | OAuth: URL oficial com `platform_id=mp` e state de uso único; state forjado, vencido ou reutilizado é recusado; erro do Mercado Pago é recusado | ✅ | `apps/api/payments.js:37`, `apps/api/payments.js:51`; testes "conectar: …" e "callback com erro …" |
| CA03 | Tokens do vendedor nunca saem da API nem ficam em texto puro no banco (AES-256-GCM) | ✅ | `apps/api/mercadopago.js:211`, `apps/api/payments.js:72`; testes "tokens nunca saem da API" e "token do vendedor cifrado" |
| CA04 | Renovação do token antes de 7 dias do vencimento, trocando os dois tokens; renovação recusada desconecta (409), sem cair para o token da AgroTech | ✅ | `apps/api/payments.js:86`; teste "token perto de vencer …" |
| CA05 | Pedido com mais de um vendedor: 400; vendedor sem conta conectada: 409 | ✅ | `apps/api/payments.js:133`; teste "dois vendedores …" |
| CA06 | Preferência com o token do vendedor, um item com o total do servidor, `marketplace_fee` da comissão, `external_reference` igual ao id e `X-Idempotency-Key`; sem `collector_id` | ✅ | `apps/api/payments.js:110`; teste "pedido cria a preferência …" |
| CA07 | Reenvio com a mesma `Idempotency-Key` não cria segunda preferência | ✅ | `apps/api/server.js:934` (o reenvio volta antes da preferência), `apps/api/mercadopago.js:81` (`X-Idempotency-Key` = id do pedido); teste "pedido cria a preferência …" |
| CA08 | Mercado Pago fora do ar: 502, sem pedido e sem reserva | ✅ | `apps/api/server.js:1062`; teste "Mercado Pago fora do ar" |
| CA09 | Webhook: sem peças 400, assinatura errada ou `ts` velho 401, nada muda; aprovado paga; repetir não muda | ✅ | `apps/api/mercadopago.js:192`, `apps/api/server.js:1164`; testes de assinatura e "webhook aprovado …" |
| CA10 | Valor, referência ou recebedor divergente não muda o pedido e marca revisão | ✅ | `packages/domain/payments.js:91`; testes "valor divergente" |
| CA11 | Recusado não cancela (o comprador tenta de novo); pendente segura a reserva até o vencimento | ✅ | `packages/domain/payments.js:66`; testes "recusado não cancela", "sync …", varredura |
| CA12 | Estorno do pagamento que pagou: ESTORNADO, com o estoque devolvido uma vez | ✅ | `apps/api/payments.js:176`; teste "estorno depois de pago" |
| CA13 | Varredura cancela a reserva vencida sem pagamento e devolve o estoque | ✅ | `apps/api/payments.js:252`, `apps/api/server.js:1178`; teste "varredura …" |
| CA14 | Comissão: ADMIN define de 0 a 30% (2 casas); cálculo em pontos-base, para baixo, nunca o total | ✅ | `packages/domain/payments.js:36`, `apps/api/server.js:1135`; testes "comissão …" |
| CA15 | Extrato e receita: aguardando e cancelado não entram; estornado entra e é desfeito | ✅ | `packages/domain/finance.js:54`, `packages/domain/finance.js:67`, `apps/api/server.js:1028`; testes "extrato …" |
| CA16 | Conexão sobrevive à gravação de outra rota; excluir a conta apaga a conexão | ✅ | `apps/api/server.js:282`, `apps/api/server.js:628`; testes correspondentes |

## 3. Contratos

- **Rotas:** em `.ai/specs/05-openapi-spec.md` (versão 1.6.0).
  - Mudou: `POST /api/orders`.
  - Novas:
    - `POST /api/orders/{id}/sync`;
    - `POST /api/payments/webhook`;
    - `POST` e `DELETE /api/mp/connect`;
    - `GET /api/mp/callback`;
    - `GET /api/mp/status`;
    - `GET` e `PUT /api/admin/settings`.
- **Dados novos no `db.json`:**
  - `sellerAccounts[]`, `oauthStates[]`, `settings`, mais os campos de pagamento no pedido. O formato
    está na seção 11 da spec 10.
  - Os três entram no `readDb` (`apps/api/server.js:282`); sem isso, o próximo `writeDb` de qualquer
    rota os apagaria.
- **Variáveis:** nomes no `.env.example`, sem valores.
  - `MP_ACCESS_TOKEN` (token da AgroTech) não é exigido nesta parte; volta no patrocínio (RF-06).
- **Testes:** `tests/payments.test.js` (regras puras, assinatura, cifra) e `tests/payments-api.test.js`
  (API de verdade contra o Mercado Pago falso de `tests/helpers/fake-mercadopago.js`).

## 4. Decisões técnicas

- **Cliente do Mercado Pago:** um módulo só, com o `fetch` do Node, sem SDK. Dependência nova pede
  aprovação; toda chamada fica isolada. Ref: `apps/api/mercadopago.js:77` `[NOVO]`.
- **Endereço do Mercado Pago:** `MP_API_BASE` e `MP_AUTH_BASE` trocam o endereço só para os testes.
  O padrão é o oficial (`api.mercadopago.com`, `auth.mercadopago.com`). Ref: `apps/api/mercadopago.js:18`.
- **Checkout Pro na API de preferências** (`/checkout/preferences`), não na de Orders: é o contrato
  `checkout-pro` do guia de marketplace do plugin oficial. Ref: `apps/api/mercadopago.js:165`.
- **Preferência com um item só,** no valor do total. O total sai de `calculateCartSummary`, com frete
  e cupom (`apps/api/server.js:956`). Listar os produtos daria o subtotal, e o valor pago
  nunca bateria com o total. Ref: `apps/api/payments.js:110`.
- **`notification_url` e `auto_return` só com `APP_URL` público em https:** o Mercado Pago recusa
  endereço local. Ref: `apps/api/payments.js:110`.
- **Troca do código OAuth em `application/x-www-form-urlencoded`,** como no guia do plugin. A página
  oficial mostra exemplo em JSON; a confirmar no sandbox. Ref: `apps/api/mercadopago.js:136`.
- **`ts` do `x-signature`:** a documentação mostra segundos (10 dígitos) e uma fonte fala em
  milissegundos, então os dois são aceitos. Janela de 5 minutos. `data.id` em minúsculas, lido da query
  com o corpo como reserva. Ref: `apps/api/mercadopago.js:192`.
- **Estado do pagamento em `paymentStatus`;** o `status` continua sendo o texto das telas. Ref:
  `packages/domain/payments.js:13`.
- **Webhook com 200 logo depois da assinatura** e o processamento em seguida, na própria vez da fila.
  A fila devolve a vez no `res.end` (`apps/api/server.js:424`), então o trabalho depois do 200 pega outra
  vez com `withWriteTurn`. O mesmo vale para a volta do OAuth (GET) e para a varredura. Ref:
  `apps/api/server.js:290`.
- **A reserva é a baixa de estoque que já existia.** A devolução acontece só na transição para
  CANCELADO ou ESTORNADO, então uma vez por pedido. Ref: `apps/api/payments.js:169`,
  `apps/api/payments.js:176`.
- **Chamadas ao Mercado Pago dentro do pedido e do sync seguram a fila de escrita** (até 10 s). Fica
  anotado com `ponytail:` em `apps/api/server.js:1062`.

## 5. Must have

- [x] Modo simulado intocado e configuração validada na subida (CA01): `apps/api/mercadopago.js:18`,
  `apps/api/server.js:67`; `tests/payments-api.test.js`, `tests/payments-flows.test.js`.
- [x] OAuth do vendedor, cifra e renovação (CA02 a CA04): `apps/api/payments.js:37`,
  `apps/api/payments.js:86`, `apps/api/mercadopago.js:211`; `tests/payments-api.test.js`.
- [x] Pedido com Checkout Pro, comissão, reserva e 502 (CA05 a CA08): `apps/api/payments.js:133`,
  `apps/api/server.js:1062`; `tests/payments-api.test.js`.
- [x] Webhook, sync e varredura com as regras de estado (CA09 a CA13): `apps/api/server.js:1164`,
  `apps/api/payments.js:228`, `apps/api/payments.js:252`; `tests/payments-api.test.js`.
- [x] Comissão e extrato (CA14 a CA16): `packages/domain/payments.js:36`, `packages/domain/finance.js:67`;
  `tests/payments.test.js`.

## 6. Nice to have (próximas partes)

- [ ] Estorno pelo ADMIN (RF-08).
- [ ] Telas (parte 3):
  - carrinho de um vendedor;
  - abrir o `checkoutUrl`;
  - volta com sync;
  - conectar a conta;
  - comissão;
  - `POST /api/orders/{id}/cancel`;
  - `payments` em `/api/app-config` (adiado: o PR #88 reescreve essa rota).
- [ ] Patrocínio pago (RF-06), depois da spec 09.

## 7. Fonte de verdade em caso de divergência

A spec manda no "o quê"; este blueprint, no "como". As divergências abaixo também foram registradas
na spec 10, no mesmo PR.

## 8. Divergências / achados durante a implementação

- **Um vendedor por pedido só com o Mercado Pago ligado.** No simulado o pedido segue como hoje, senão
  a web e o app quebrariam antes das telas (spec 10, RF-02, atualizada).
- **Recusado não cancela.** A tabela original mandava `rejected` para CANCELADO, mas no Checkout Pro o
  comprador pode tentar outro cartão na mesma preferência. O pedido só cancela quando a reserva vence
  sem pagamento aprovado ou pendente (spec 10, RF-04, atualizada).
- **Não há dedup por `type` + `data.id`.** O mesmo pagamento muda de status (aprovado e depois
  estornado), e o descarte pelo id perderia o estorno. A proteção é a aplicação idempotente
  (spec 10, RF-04, atualizada).
- **`merchant_order` é aceito e ignorado;** a varredura e o sync cobrem (spec 10, RF-04, atualizada).
- **`POST /api/mp/connect`, não `GET`:** a rota grava o state e assim passa pela fila de escrita
  (spec 10, seção 11, atualizada).
- **O vencimento é conferido pela varredura e pelo sync, não na leitura** (`GET` não grava; spec 10,
  RF-05, atualizada).
- **Achado de ferramenta:** no checkout principal, o `eslint .` também varre `.claude/worktrees/*`, e
  com uma worktree aberta os avisos dobram, o que trava o `pre-push`. O `eslint.config.js` só ignora
  `node_modules/` e `.qa/`. Fica reportado, sem correção neste PR (fora do escopo).
- **Achado do plugin do Mercado Pago:** o hook dele barra valores no formato de segredo de webhook
  escritos no código, inclusive em teste. Os testes geram os segredos na execução.

## 9. Não exercitado (precisa de conta e endereço reais)

- Credenciais reais, consentimento OAuth de um vendedor real e entrega real do webhook. Tudo foi
  testado contra o Mercado Pago falso local.
- Se o `user_id` da notificação é o do vendedor em pagamento de marketplace: a confirmar com uma
  notificação real; se não for, a varredura cobre.
- Formato de `/oauth/token` (form ou JSON), a confirmar no sandbox.
- **Janela de 5 minutos do `ts`:** supõe que o Mercado Pago assina cada reenvio com um `ts` novo. Os
  reenvios chegam 15 minutos ou mais depois; se reaproveitarem o `ts` original, todo reenvio leva 401.
  - Nada se perde: a varredura reconsulta o pedido pendente em até cerca de 3 minutos.
  - Uma notificação reenviada também seria inofensiva, porque o handler reconsulta o pagamento e
    aplica de forma idempotente.
  - Se o sandbox mostrar `ts` reaproveitado, alargar ou tirar a janela (e atualizar a spec 10).
- Os itens acima exigem URL pública HTTPS (deploy da API, decisão aberta).
