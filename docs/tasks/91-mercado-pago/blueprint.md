# Blueprint: Mercado Pago, partes 1 e 2 (API dos pedidos e estorno)

Spec: `.ai/specs/10-pagamentos-mercado-pago.md` (issue #91).

| Parte | Cobre | Situação |
|---|---|---|
| 1 | RF-01 (OAuth do vendedor), RF-02 (servidor), RF-03, RF-04, RF-05, RF-07 e o extrato do RF-09 | mesclada (PR #93) |
| 2 | estorno pelo ADMIN (RF-08), seção 10 | esta branch |
| 3 | telas da web e do app | depois |
| 4 | patrocínio pago (RF-06): depende das `sponsorships` da spec 09, que ainda não existem | depois |

## 1. Dor do usuário

No modo simulado, o pedido nasce "Pedido Confirmado" sem dinheiro ter entrado (`apps/api/server.js:973`). O
comprador precisa pagar de verdade, e o vendedor precisa receber direto do Mercado Pago, com a comissão
da AgroTech descontada.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Status | Evidência |
|----|----------|--------|-----------|
| CA01 | Sem `MP_*`, nada muda (modo simulado); configuração pela metade não sobe | ✅ | `apps/api/mercadopago.js:18`, `apps/api/server.js:68`; `tests/payments-api.test.js` "configurado pela metade"; suíte antiga verde (345/345) |
| CA02 | OAuth: URL oficial com `platform_id=mp` e state de uso único; state forjado, vencido ou reutilizado é recusado; erro do Mercado Pago é recusado | ✅ | `apps/api/payments.js:37`, `apps/api/payments.js:51`; testes "conectar: …" e "callback com erro …" |
| CA03 | Tokens do vendedor nunca saem da API nem ficam em texto puro no banco (AES-256-GCM) | ✅ | `apps/api/mercadopago.js:223`, `apps/api/payments.js:72`; testes "tokens nunca saem da API" e "token do vendedor cifrado" |
| CA04 | Renovação do token antes de 7 dias do vencimento, trocando os dois tokens; renovação recusada desconecta (409), sem cair para o token da AgroTech | ✅ | `apps/api/payments.js:86`; teste "token perto de vencer …" |
| CA05 | Pedido com mais de um vendedor: 400; vendedor sem conta conectada: 409 | ✅ | `apps/api/payments.js:133`; teste "dois vendedores …" |
| CA06 | Preferência com o token do vendedor, um item com o total do servidor, `marketplace_fee` da comissão, `external_reference` igual ao id e `X-Idempotency-Key`; sem `collector_id` | ✅ | `apps/api/payments.js:110`; teste "pedido cria a preferência …" |
| CA07 | Reenvio com a mesma `Idempotency-Key` não cria segunda preferência | ✅ | `apps/api/server.js:940` (o reenvio volta antes da preferência), `apps/api/mercadopago.js:83` (`X-Idempotency-Key` = id do pedido); teste "pedido cria a preferência …" |
| CA08 | Mercado Pago fora do ar: 502, sem pedido e sem reserva | ✅ | `apps/api/server.js:1068`; teste "Mercado Pago fora do ar" |
| CA09 | Webhook: sem peças 400, assinatura errada ou `ts` velho 401, nada muda; aprovado paga; repetir não muda | ✅ | `apps/api/mercadopago.js:204`, `apps/api/server.js:1192`; testes de assinatura e "webhook aprovado …" |
| CA10 | Valor, referência ou recebedor divergente não muda o pedido e marca revisão | ✅ | `packages/domain/payments.js:104`; testes "valor divergente" |
| CA11 | Recusado não cancela (o comprador tenta de novo); pendente segura a reserva até o vencimento | ✅ | `packages/domain/payments.js:68`; testes "recusado não cancela", "sync …", varredura |
| CA12 | Estorno do pagamento que pagou: ESTORNADO, com o estoque devolvido uma vez | ✅ | `apps/api/payments.js:176`; teste "estorno depois de pago" |
| CA13 | Varredura cancela a reserva vencida sem pagamento e devolve o estoque | ✅ | `apps/api/payments.js:300`, `apps/api/server.js:1209`; teste "varredura …" |
| CA14 | Comissão: ADMIN define de 0 a 30% (2 casas); cálculo em pontos-base, para baixo, nunca o total | ✅ | `packages/domain/payments.js:36`, `apps/api/server.js:1141`; testes "comissão …" |
| CA15 | Extrato e receita: aguardando e cancelado não entram; estornado entra e é desfeito | ✅ | `packages/domain/finance.js:54`, `packages/domain/finance.js:67`, `apps/api/server.js:1034`; testes "extrato …" |
| CA16 | Conexão sobrevive à gravação de outra rota; excluir a conta apaga a conexão | ✅ | `apps/api/server.js:283`, `apps/api/server.js:634`; testes correspondentes |

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
  - Os três entram no `readDb` (`apps/api/server.js:283`); sem isso, o próximo `writeDb` de qualquer
    rota os apagaria.
- **Variáveis:** nomes no `.env.example`, sem valores.
  - `MP_ACCESS_TOKEN` (token da AgroTech) não é exigido nesta parte; volta no patrocínio (RF-06).
- **Testes:** `tests/payments.test.js` (regras puras, assinatura, cifra) e `tests/payments-api.test.js`
  (API de verdade contra o Mercado Pago falso de `tests/helpers/fake-mercadopago.js`).

## 4. Decisões técnicas

- **Cliente do Mercado Pago:** um módulo só, com o `fetch` do Node, sem SDK. Dependência nova pede
  aprovação; toda chamada fica isolada. Ref: `apps/api/mercadopago.js:79` `[NOVO]`.
- **Endereço do Mercado Pago:** `MP_API_BASE` e `MP_AUTH_BASE` trocam o endereço só para os testes.
  O padrão é o oficial (`api.mercadopago.com`, `auth.mercadopago.com`). Ref: `apps/api/mercadopago.js:18`.
- **Checkout Pro na API de preferências** (`/checkout/preferences`), não na de Orders: é o contrato
  `checkout-pro` do guia de marketplace do plugin oficial. Ref: `apps/api/mercadopago.js:168`.
- **Preferência com um item só,** no valor do total. O total sai de `calculateCartSummary`, com frete
  e cupom (`apps/api/server.js:962`). Listar os produtos daria o subtotal, e o valor pago
  nunca bateria com o total. Ref: `apps/api/payments.js:110`.
- **`notification_url` e `auto_return` só com `APP_URL` público em https:** o Mercado Pago recusa
  endereço local. Ref: `apps/api/payments.js:110`.
- **Troca do código OAuth em `application/x-www-form-urlencoded`,** como no guia do plugin. A página
  oficial mostra exemplo em JSON; a confirmar no sandbox. Ref: `apps/api/mercadopago.js:138`.
- **`ts` do `x-signature`:** a documentação mostra segundos (10 dígitos) e uma fonte fala em
  milissegundos, então os dois são aceitos. Janela de 5 minutos. `data.id` em minúsculas, lido da query
  com o corpo como reserva. Ref: `apps/api/mercadopago.js:204`.
- **Estado do pagamento em `paymentStatus`;** o `status` continua sendo o texto das telas. Ref:
  `packages/domain/payments.js:13`.
- **Webhook processa e só então responde:** 200 depois de gravar; falha responde 500 e o Mercado Pago
  reenvia. Ref: `apps/api/server.js:1192`.
  - Começou com "200 logo depois da assinatura", como manda o guia do plugin. Na suíte inteira, uma
    gravação recusada depois do 200 perdeu um estorno, que a varredura não recupera (ver seção 8).
  - Como é um `POST`, a rota roda dentro da vez da fila de escrita.
  - A volta do OAuth (GET) e a varredura gravam fora de uma requisição de escrita e pegam a vez com
    `withWriteTurn`, porque a fila devolve a vez no `res.end` (`apps/api/server.js:430`). Ref:
    `apps/api/server.js:291`.
- **`writeDb` tenta a troca do arquivo de novo** em `EPERM`/`EBUSY`/`EACCES` (até 10 vezes). No
  Windows, o rename por cima de um `db.json` aberto por outro leitor falha por alguns milissegundos.
  Ref: `apps/api/server.js:308`, `apps/api/rename-retry.js:15`; teste `tests/rename-retry.test.js`.
- **A reserva é a baixa de estoque que já existia.** A devolução acontece só na transição para
  CANCELADO ou ESTORNADO, então uma vez por pedido. Ref: `apps/api/payments.js:169`,
  `apps/api/payments.js:176`.
- **Chamadas ao Mercado Pago dentro do pedido e do sync seguram a fila de escrita** (até 10 s). Fica
  anotado com `ponytail:` em `apps/api/server.js:1068`.

## 5. Must have

- [x] Modo simulado intocado e configuração validada na subida (CA01): `apps/api/mercadopago.js:18`,
  `apps/api/server.js:68`; `tests/payments-api.test.js`, `tests/payments-flows.test.js`.
- [x] OAuth do vendedor, cifra e renovação (CA02 a CA04): `apps/api/payments.js:37`,
  `apps/api/payments.js:86`, `apps/api/mercadopago.js:223`; `tests/payments-api.test.js`.
- [x] Pedido com Checkout Pro, comissão, reserva e 502 (CA05 a CA08): `apps/api/payments.js:133`,
  `apps/api/server.js:1068`; `tests/payments-api.test.js`.
- [x] Webhook, sync e varredura com as regras de estado (CA09 a CA13): `apps/api/server.js:1192`,
  `apps/api/payments.js:276`, `apps/api/payments.js:300`; `tests/payments-api.test.js`.
- [x] Comissão e extrato (CA14 a CA16): `packages/domain/payments.js:36`, `packages/domain/finance.js:67`;
  `tests/payments.test.js`.

## 6. Nice to have (próximas partes)

- [x] Estorno pelo ADMIN (RF-08), parte 2: `apps/api/payments.js:248`, `apps/api/server.js:1173`; seção 10.
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

- **Webhook responde depois de gravar** (2026-11-13). O teste de estorno falhou duas vezes com a suíte
  inteira rodando.
  - O log mostrou a causa: no Windows, o rename do `writeDb` deu `EPERM` porque um leitor tinha o
    `db.json` aberto. Como o 200 já tinha saído, o Mercado Pago não reenviaria, e o estorno se perderia.
  - Correções:
    - o `writeDb` tenta a troca de novo (`apps/api/rename-retry.js`);
    - o webhook só responde 200 depois de gravar e, em falha, responde 500 para o Mercado Pago
      reenviar.
  - Spec 10 (RF-04) e spec 05 atualizadas.
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

## 10. Parte 2: estorno pelo ADMIN (RF-08)

| ID | Critério | Status | Evidência |
|----|----------|--------|-----------|
| CA17 | Só o ADMIN estorna; pedido sem pagamento a estornar: 409; inexistente: 404 | ✅ | `apps/api/server.js:1173`; teste "estorno: só o ADMIN …" |
| CA18 | Estorno total com o token do vendedor e `X-Idempotency-Key` `estorno-<paymentId>`; confirmado, ESTORNADO e estoque devolvido | ✅ | `apps/api/payments.js:248`, `apps/api/mercadopago.js:181`; teste "estorno de pedido pago …" |
| CA19 | Estorno aceito e ainda não confirmado não muda o pedido; a varredura confirma depois | ✅ | `apps/api/payments.js:240`, `apps/api/payments.js:300`; testes "estorno aceito mas ainda não confirmado …" e "varredura confirma o estorno …" |
| CA20 | Mercado Pago recusa (ex.: vendedor sem saldo) ou vendedor desconectado: 409; fora do ar: 502; nada muda | ✅ | `apps/api/payments.js:248`; testes "Mercado Pago recusa o estorno …" e "estorno: pedido simulado …" |
| CA21 | Pagamento em revisão (aprovado depois do cancelamento ou valor divergente) pode ser estornado; confirmado, a revisão fica resolvida e o pedido não muda | ✅ | `apps/api/payments.js:232`, `packages/domain/payments.js:93`; testes "pagamento em revisão …" e "o pagamento em revisão, estornado, resolve a revisão" |

- **Rota:** `POST /api/admin/orders/{id}/refund`, que responde 202 com a mensagem da divisão
  proporcional e o pedido. Contrato em `.ai/specs/05-openapi-spec.md`.
- **Decisão:** o estorno usa o token do **vendedor**, porque o pagamento foi criado com ele. No
  marketplace, o Mercado Pago divide a devolução de forma proporcional entre o vendedor e a comissão
  (guia de split do plugin). Ref: `apps/api/mercadopago.js:181`.
- **Decisão:** o pedido não muda no pedido de estorno.
  - Logo depois, o servidor consulta o pagamento (`syncOrder`). Se o Mercado Pago já confirmou, a
    resposta 202 já traz o pedido ESTORNADO.
  - Se não confirmou, a varredura passa a incluir esse pedido até confirmar
    (`apps/api/payments.js:240`).
- **Divergência registrada na spec 10 (RF-08):** a spec previa estornar só o pedido PAGO (e o
  patrocínio). A rota também estorna o pagamento em revisão, porque era o único jeito, fora do painel
  do Mercado Pago, de devolver o dinheiro do pagamento aprovado depois do cancelamento.
- **Não exercitado:** estorno real (credenciais e conta de teste). Também falta confirmar a resposta do
  Mercado Pago quando o vendedor não tem saldo; o teste supõe 4xx.

## 11. Sandbox (2026-11-13)

- `MP_OAUTH_TEST_TOKEN=1` faz a troca do código OAuth mandar `test_token=true`, para o vendedor de
  conta de teste receber token de teste. A documentação oficial do OAuth diz que `test_token` "true"
  gera credenciais de sandbox. Vazio em produção. Ref: `apps/api/mercadopago.js:138`; teste "sandbox:
  com MP_OAUTH_TEST_TOKEN=1 …" em `tests/payments-flows.test.js`.
