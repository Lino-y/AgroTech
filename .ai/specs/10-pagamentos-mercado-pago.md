# 10 — Pagamentos pelo Mercado Pago (pedidos e patrocínio)

## 1. Identificação

- Nome da funcionalidade: Mercado Pago como hub de pagamento
- Módulo: Pedidos, Patrocínio (spec 09), Financeiro; app Android `apps/mobile`, web `src/`, API
  `apps/api`
- Data: 2026-11-12
- Responsável: a definir na issue
- Status: [x] nova [ ] atualização — **proposta, aguardando aprovação**. Nenhum requisito
  implementado.
- Origem: pedido do usuário em 2026-11-12 ("utilizar o Mercado Pago como hub de pagamento").
- Depende de: `.ai/specs/09-destaques-e-patrocinados.md` (patrocínio) e de um endereço público HTTPS
  para a API (seção 10).

## 2. Objetivo

Hoje o pagamento é **simulado**:

- **Web e app:** a escolha da forma (Pix, cartão, boleto) não vai para o servidor
  (`src/modules/catalog.js:85`, `apps/mobile/src/screens/CartScreen.tsx:18`). O app avisa
  "Pagamento simulado nesta versão" (`CartScreen.tsx:183`).
- **API:** o pedido nasce como `'Pedido Confirmado'` (`apps/api/server.js:895`) e baixa o estoque
  na criação (`server.js:862`), sem dinheiro nenhum ter entrado.
- **Requisitos:** o RF04 promete "Checkout via Pix, Cartão (6x) e Boleto"
  (`.ai/specs/02-requisitos-funcionais.md:6`).

A funcionalidade torna o pagamento real, pelo Mercado Pago, em dois fluxos:

1. **Pedido:** o comprador paga o vendedor. O Mercado Pago repassa ao vendedor e retém a comissão
   da AgroTech.
2. **Patrocínio (spec 09):** o vendedor paga a AgroTech, e a campanha só ativa com o pagamento
   aprovado.

## 3. Decisões tomadas (2026-11-12, com o usuário)

1. **Pedidos e patrocínio passam pelo Mercado Pago.** A implementação começa pelo patrocínio:
   - é mais simples, porque a AgroTech é a única recebedora e não há split;
   - testa webhook, assinatura e conciliação antes de mexer em dinheiro de terceiro.
2. **No pedido, o dinheiro vai direto ao vendedor, com comissão (marketplace do Mercado Pago).**
   - Cada vendedor conecta a própria conta Mercado Pago ao app (OAuth).
   - A AgroTech **nunca recebe nem repassa** dinheiro de terceiro.
   - A alternativa (uma conta da AgroTech que repassa) foi descartada pelo risco regulatório e
     fiscal e pela conciliação manual.
3. **Um vendedor por carrinho.** O split do Mercado Pago é 1:1, um vendedor por pagamento.
   - Ao adicionar produto de outro vendedor, o app avisa e pergunta se troca o carrinho.
   - Um pedido corresponde a um pagamento.
4. **Checkout Pro.** O app abre a página de pagamento do Mercado Pago (Pix, cartão parcelado,
   boleto, saldo) e volta ao app no fim.
   - Nenhum dado de cartão passa pelo app, pela web ou pela API da AgroTech.
   - O Checkout Transparente foi descartado por exigir mais telas e regras de segurança, e por não
     ter componente nativo pronto para React Native.

## 4. Escopo

### Inclui

- Conexão da conta Mercado Pago do vendedor (OAuth), renovação do token e desconexão.
- Pagamento de pedido via Checkout Pro, com comissão da AgroTech, no app e na web.
- Pagamento de patrocínio via Checkout Pro, com recebimento da AgroTech.
- Webhook de pagamento com validação de assinatura, e conciliação do estado do pedido e da campanha.
- Reserva de estoque enquanto o pagamento está pendente, devolvida se o pagamento falhar ou expirar.
- Estorno pelo ADMIN (total) e o reflexo dele no pedido, no estoque e no extrato.
- Extrato financeiro contando só o que foi pago.

### Não inclui

- Checkout Transparente, cartão salvo, assinatura recorrente.
- Carrinho com vários vendedores (decisão 3).
- Repasse manual de dinheiro pela AgroTech (decisão 2).
- Nota fiscal, cálculo de imposto, antecipação de recebíveis.
- Estorno parcial e disputa (chargeback) tratada dentro do app: o chargeback só muda o estado do
  pedido; a disputa corre no painel do Mercado Pago.
- iOS: o app segue Android-only (spec 08).

## 5. Usuários e perfis impactados

- **Comprador (PRODUTOR/AMBOS):** paga o pedido no Mercado Pago e vê o estado real.
- **Vendedor (VENDEDOR/AMBOS):**
  - conecta a conta Mercado Pago antes de vender, e só anúncio de vendedor conectado pode ser
    comprado;
  - paga o patrocínio;
  - recebe direto do Mercado Pago, já descontadas a taxa do Mercado Pago e a comissão da AgroTech.
- **ADMIN (master):**
  - define a comissão e a tabela de planos de patrocínio;
  - vê os pagamentos e estorna.

## 6. Requisitos funcionais

Status de todos: **pendente**. Itens novos estão marcados `[NOVO]`.

### RF-01 — Conectar a conta Mercado Pago do vendedor `[NOVO]`

- **Descrição:** em Conta → "Receber pelo Mercado Pago", o vendedor autoriza a AgroTech pelo OAuth
  do Mercado Pago.
  - O servidor troca o código pelo token do vendedor (`POST /oauth/token`) e guarda
    `access_token`, `refresh_token`, `expires_at` e o `user_id` do Mercado Pago.
  - Pede o escopo `offline_access`, sem o qual não há renovação.
  - A URL de autorização leva `client_id`, `response_type=code`, `platform_id=mp`, o `state` e
    exatamente o `MP_OAUTH_REDIRECT_URI` cadastrado no painel do Mercado Pago.
  - O `state` é gerado no servidor, aleatório, de uso único, ligado ao usuário logado, gravado no
    `db.json` (não em memória: precisa sobreviver a reinício) e vence em 10 minutos.
  - O callback trata `error` do Mercado Pago, recusa `state` ausente, vencido ou reutilizado, e
    exige `code`.
  - A troca do código é no servidor: `POST /oauth/token`, `application/x-www-form-urlencoded`,
    `grant_type=authorization_code`, com o mesmo `redirect_uri`.
  - O PKCE fica ligado na aplicação do Mercado Pago.
- **Segurança do token:**
  - O token do vendedor dá acesso à conta dele: **nunca** sai do servidor, nunca vai em resposta
    nem em log.
  - Fica cifrado em repouso no `db.json` (AES-256-GCM, chave em variável de ambiente).
- **Renovação:** antes do vencimento (o token vale 180 dias, segundo a documentação do Mercado
  Pago), o servidor renova com o `refresh_token` (`grant_type=refresh_token`). Ele troca os dois
  tokens de uma vez, porque cada renovação troca também o `refresh_token`.
  - Se a renovação falhar, o vendedor aparece como desconectado e é avisado.
- **Desconectar:** apaga os tokens.
  - Anúncios do vendedor ficam visíveis, mas sem botão de compra ("Vendedor sem pagamento ativo").
  - Excluir a conta também apaga os tokens (`DELETE /api/auth/me`, `apps/api/server.js:546`).
- **Critério de aceite:**
  - teste de API do `state` inválido, reutilizado e vencido, todos recusados;
  - teste de que nenhuma resposta da API contém o token;
  - teste da renovação, com o Mercado Pago simulado, gravando o novo `refresh_token`.

### RF-02 — Carrinho de um vendedor só `[NOVO]`

- **Descrição:**
  - **App e web:** ao adicionar produto de outro vendedor, o app pergunta: "Seu carrinho tem itens
    de outro vendedor. Trocar o carrinho?".
  - **Servidor:** `POST /api/orders` recusa (400) um pedido com itens de mais de um vendedor, ou de
    vendedor sem conta Mercado Pago conectada (409). O servidor não confia no app.
  - A regra vale **com o Mercado Pago ligado**. No modo simulado, sem as variáveis `MP_*`, o pedido
    segue como hoje, para a web e o app continuarem funcionando até a parte das telas (decisão da
    implementação, 2026-11-12).
- **Critério de aceite:** teste de API com dois vendedores (400), teste com vendedor desconectado
  (409) e teste de domínio da regra do carrinho.

### RF-03 — Pagar o pedido (Checkout Pro com comissão) `[NOVO]`

- **Descrição:**
  1. `POST /api/orders` passa a criar o pedido como `AGUARDANDO_PAGAMENTO` e devolve `checkoutUrl`.
  2. O servidor cria a preferência do Checkout Pro **com o token do vendedor**, com:
     - os itens e o total vindos do catálogo e de `calculateCartSummary`, nunca do cliente
       (`apps/api/server.js:884`);
     - `external_reference` igual ao id do pedido;
     - `marketplace_fee` igual à comissão (RF-07);
     - `notification_url` do webhook;
     - `back_urls` de retorno ao app e à web;
     - expiração em 30 minutos.
  3. O app abre `checkoutUrl` numa aba do navegador. A web redireciona.
- **API do Mercado Pago:** o Checkout Pro usa a API de preferências, exatamente em
  `POST /checkout/preferences`, sem prefixo `/v1`, e **não** a API de Orders. O split vai em
  `marketplace_fee`. Isso é o contrato `checkout-pro` do guia de marketplace do plugin oficial
  (seção 10).
  - A preferência sai com o token do vendedor no `Authorization`, **sem** `collector_id` no corpo.
  - Nunca há volta silenciosa para o token da AgroTech.
  - A API devolve ao cliente só `preferenceId` e `initPoint`, e o app abre sempre o `init_point`,
    nunca o `sandbox_init_point`.
  - `auto_return: 'approved'` só entra com `back_urls` públicas; o Mercado Pago recusa `localhost`.
- **Idempotência:** a `Idempotency-Key` que o pedido já usa (`apps/api/server.js:670`, `replayResponse` em
  `server.js:688`) continua
  valendo. O reenvio devolve o mesmo pedido e o mesmo `checkoutUrl`, sem criar segunda preferência.
- **Critério de aceite:**
  - teste de API com o Mercado Pago simulado:
    - o total e a comissão enviados ao Mercado Pago saem do servidor;
    - o reenvio com a mesma chave não cria segunda preferência;
  - teste de limite da comissão (RF-07).

### RF-04 — Webhook e estado do pagamento `[NOVO]`

- **Rota:** `POST /api/payments/webhook`, pública, sem `authenticate`.
- **Tópicos:** a decisão é sempre pelo `payment`, que se consulta em `GET /v1/payments/{id}`.
  - O `merchant_order`, que o Checkout Pro também envia, é aceito (200) e ignorado: a varredura e o
    sync acham os pagamentos do pedido pelo `external_reference`.
  - O token usado na consulta é o do vendedor cujo `mpUserId` é o `user_id` da notificação. Isso
    ainda precisa ser confirmado com uma notificação real; se não casar, a varredura cobre.
- **Cabeçalho incompleto:** falta de `x-signature`, `x-request-id` ou `data.id` responde 400.
- **Assinatura:** o servidor valida a assinatura **antes** de qualquer outra coisa.
  - Monta o manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` e calcula o HMAC-SHA256 com
    a chave secreta da aplicação.
  - Compara com o `v1` do cabeçalho `x-signature`, em tempo constante.
  - Recusa `ts` com mais de 5 minutos de diferença, contra reenvio forjado.
  - Assinatura inválida recebe 401 e nada é gravado.
- **Fonte de verdade:** o corpo da notificação só traz o id. O servidor consulta
  `GET /v1/payments/{id}` com o token certo e só confia nessa resposta. Antes de aplicar, confere:
  - `external_reference` aponta para um pedido ou campanha existente;
  - o valor é igual ao total gravado;
  - o recebedor é o vendedor do pedido (ou a AgroTech, no patrocínio).
  - Divergência não muda nada e vira log de alerta, sem dado pessoal.
- **Estados** (a lista de status do Mercado Pago é conferida na referência vigente pelo blueprint):

| Status do Mercado Pago | Pedido | Estoque |
|---|---|---|
| `approved` | `PAGO` (timeline "Pedido Confirmado") | baixa definitiva |
| `pending`, `in_process`, `authorized` | `AGUARDANDO_PAGAMENTO`; a reserva vai até o vencimento do pagamento (`date_of_expiration`) | segue reservado |
| `rejected`, `cancelled` | continua `AGUARDANDO_PAGAMENTO`: o comprador pode tentar outro meio na mesma página | segue reservado |
| reserva vencida sem pagamento aprovado nem pendente | `CANCELADO` | reserva devolvida |
| `refunded`, `charged_back` (do pagamento que pagou o pedido) | `ESTORNADO` | devolvido |

- O estado do pagamento fica no campo `paymentStatus`. O `status` continua sendo o texto que a web e o
  app mostram: "Aguardando pagamento", "Pedido Confirmado", "Cancelado" ou "Estornado". Trocar o
  `status` por códigos mostraria "PAGO" cru nas telas de hoje.
- **Repetição:** a mesma notificação pode chegar mais de uma vez (o Mercado Pago reenvia até
  receber 200/201).
  - Não há descarte por `type` + `data.id`: o mesmo pagamento muda de status (aprovado e depois
    estornado), e descartar pelo id perderia o estorno. A proteção é a aplicação idempotente: cada
    notificação reconsulta o pagamento, e aplicar de novo o mesmo estado não muda nada.
  - Estado só avança: `PAGO` nunca volta a `AGUARDANDO`.
- **Resposta:** 200 **logo depois** de validar a assinatura, antes de consultar o Mercado Pago
  (regra do guia de webhooks do plugin; o prazo do Mercado Pago é 22 s). A consulta e a gravação
  vêm em seguida, pela fila de escrita que já serializa o `db.json`.
  - Se a consulta falhar depois do 200, o Mercado Pago não reenvia. Quem recupera é a varredura do
    RF-05, que também consulta, pelo `external_reference`, os pedidos e campanhas ainda pendentes.
- **Retorno ao app sem webhook:** se o webhook não chegou (rede, servidor fora do ar), o app, ao
  voltar do Checkout Pro, pede `POST /api/orders/:id/sync`. Essa rota consulta o pagamento pelo
  `external_reference` e aplica a mesma regra. O app nunca decide que o pedido foi pago.
- **Critério de aceite:**
  - teste com assinatura válida, inválida, `ts` velho e a mesma notificação duas vezes;
  - teste de valor divergente que não muda o pedido;
  - um teste para cada linha da tabela de estados.

### RF-05 — Reserva de estoque `[NOVO]`

- **Descrição:** a baixa de estoque, que hoje acontece na criação (`apps/api/server.js:862`), vira
  reserva no `AGUARDANDO_PAGAMENTO`.
  - A reserva vence junto com a preferência (30 min). Para boleto e Pix, vale o prazo do meio de
    pagamento informado pelo Mercado Pago.
  - Ao vencer, o pedido vai para `CANCELADO` e o estoque volta.
  - O vencimento é conferido por uma varredura a cada minuto, sem fila nova, e pelo sync. A leitura
    do pedido não confere: `GET` não grava.
  - A mesma varredura consulta no Mercado Pago, pelo `external_reference`, os pedidos e campanhas
    pendentes há mais de 2 minutos. Assim, um webhook perdido não deixa pagamento sem registro.
- **Critério de aceite:**
  - teste de limite: reserva com vencimento igual a agora já está vencida;
  - teste de que dois pedidos pendentes não reservam mais que o estoque.

### RF-06 — Pagar o patrocínio `[NOVO]`, altera spec 09

- **Descrição:**
  - O ADMIN mantém uma tabela de planos de patrocínio, por exemplo 7, 15 e 30 dias, com preço.
  - O vendedor escolhe um anúncio próprio e um plano; o servidor cria a campanha como `PENDENTE`, e
    a preferência sai com o token da **AgroTech**, sem comissão.
  - Com `approved`, a campanha passa a `ATIVA`, começando na hora da aprovação.
  - Recusa ou expiração leva a campanha para `CANCELADA`.
  - Estorno pelo ADMIN leva a campanha para `ENCERRADA` na hora.
- **Cadastro manual:** o ADMIN continua podendo cadastrar uma campanha paga por fora (RF-01 da spec
  09), marcada como `origem: 'manual'`.
- **Critério de aceite:** teste do ciclo `PENDENTE` → `ATIVA` pelo webhook, e teste de que a
  campanha `PENDENTE` não aparece no catálogo.

### RF-07 — Comissão `[NOVO]`

- **Definição:** o ADMIN define a comissão da AgroTech em percentual, de 0% a 30%.
- **Cálculo no servidor:**
  - valor em reais, arredondado para baixo no centavo;
  - nunca maior que o total menos 1 centavo;
  - gravado no pedido no momento da criação. Mudar a comissão depois não altera pedido antigo.
- **Taxa do Mercado Pago:** o Mercado Pago desconta a taxa dele primeiro e retém a comissão sobre o
  restante, como na documentação de split. A tela do vendedor mostra essa ordem.
- **Critério de aceite:** teste de domínio para 0%, 30%, arredondamento e total de R$ 0,01.

### RF-08 — Estorno (ADMIN) `[NOVO]`

- **Descrição:** o ADMIN estorna o total de um pedido `PAGO` ou de um patrocínio.
  - O servidor pede o estorno ao Mercado Pago.
  - O estado só muda quando o webhook (ou o sync) confirmar `refunded`.
- **Limite do split:** o reembolso é dividido proporcionalmente entre o vendedor e a AgroTech.
  - Sem saldo do vendedor, a AgroTech só devolve a parte dela, como diz a documentação do Mercado
    Pago.
  - A tela avisa isso antes de confirmar.
- **Critério de aceite:** teste de API com o Mercado Pago simulado, e teste de que o estado não
  muda antes da confirmação.

### RF-09 — Financeiro, textos e telas que mudam `[NOVO]`

- **Extrato:** `buildFinanceEntries` (`packages/domain/finance.js:45`) hoje soma todos os pedidos
  (`finance.js:51`). Passa a contar só `PAGO`, e lança o `ESTORNADO` como estorno. Para o vendedor,
  mostra o valor líquido quando o Mercado Pago o informar.
- **Meus pedidos:** a timeline mostra "Aguardando pagamento", "Pagamento recusado", "Cancelado" e
  "Estornado", além das etapas de hoje.
- **Textos:**
  - A resposta do suporte promete "6x sem juros" e "boleto em 3 dias úteis"
    (`packages/domain/support.js:30`). Passa a dizer só que o pagamento é pelo Mercado Pago (Pix,
    cartão e boleto), porque parcela e juros dependem da conta do vendedor.
  - O aviso "Pagamento simulado" (`CartScreen.tsx:183`) sai.
- **Formulários:** a escolha de forma de pagamento sai da web (`src/modules/catalog.js:1316`) e do
  app (`CartScreen.tsx:167`), porque quem escolhe é a página do Mercado Pago.
- **Critério de aceite:** teste de domínio do extrato com pedido pendente (não entra) e estornado
  (entra como estorno).

## 7. Requisitos não funcionais

- **Segurança:**
  - Credenciais só em variável de ambiente; o `.env.example` recebe só os nomes, nunca valores,
    com os mesmos nomes do guia do plugin:
    - `MP_ACCESS_TOKEN`: da AgroTech, usado no patrocínio;
    - `MP_APP_ID`, `MP_CLIENT_SECRET`, `MP_OAUTH_REDIRECT_URI`;
    - `MP_WEBHOOK_SECRET`, `MP_TOKEN_ENCRYPTION_KEY`;
    - `APP_URL`: endereço público da API.
    - Não há `MP_PUBLIC_KEY`, porque o Checkout Pro redireciona e não tokeniza cartão no app.
  - Sem `MP_WEBHOOK_SECRET`, o servidor não sobe com pagamento ligado, e falha em voz alta.
  - Nenhum dado de cartão passa pela AgroTech.
  - Tokens de vendedor cifrados em repouso.
  - Webhook com assinatura obrigatória.
  - Valor e recebedor conferidos com a consulta ao Mercado Pago.
- **Modo simulado:** sem as variáveis `MP_*`, o servidor segue com o pagamento simulado de hoje, e
  `/api/app-config` informa `payments: 'simulado' | 'mercadopago'`. Assim os testes e o
  desenvolvimento local não dependem do Mercado Pago.
- **Offline:** pagar exige internet; o app já bloqueia o pedido offline (`CartScreen.tsx:92`).
  Pedido pendente aparece em "Meus pedidos" salvos, com o estado da última sincronização.
- **Disponibilidade:** webhook perdido é recuperado pelo reenvio do Mercado Pago e pelo sync do
  RF-04. Nenhum pedido fica pago sem confirmação do Mercado Pago.
- **LGPD/compliance:**
  - A AgroTech guarda só o id do pagamento, o status, o meio (pix, cartão ou boleto), o valor e as
    datas; nunca número de cartão nem documento do pagador.
  - A política de privacidade e os termos citam o Mercado Pago como processador de pagamento e a
    comissão.
- **Observabilidade:** cada mudança de estado do pagamento grava data, status anterior, status novo
  e origem (webhook, sync ou ADMIN). Os logs não levam token nem dado do pagador.

## 8. Fluxo principal (pedido)

1. O vendedor conecta a conta Mercado Pago (RF-01).
2. O comprador monta o carrinho de um vendedor e toca em "Pagar com Mercado Pago".
3. A API cria o pedido `AGUARDANDO_PAGAMENTO`, reserva o estoque, cria a preferência com a comissão
   e devolve `checkoutUrl`.
4. O app abre o Checkout Pro; o comprador paga com Pix, cartão ou boleto.
5. O Mercado Pago chama o webhook. A API valida a assinatura, consulta o pagamento, confere valor e
   recebedor e marca `PAGO`.
6. O comprador volta ao app pelo deep link. O app pede o sync e mostra "Pagamento aprovado".
7. O vendedor recebe na conta Mercado Pago, já com a taxa do Mercado Pago e a comissão descontadas.

## 9. Fluxos alternativos e erros

- **O comprador fecha o Checkout Pro sem pagar:** o pedido fica `AGUARDANDO_PAGAMENTO` até vencer.
  Em "Meus pedidos", aparece "Pagar agora" (o mesmo `checkoutUrl`) e "Cancelar".
- **Boleto:** fica `AGUARDANDO_PAGAMENTO` até a compensação, com a reserva no prazo do boleto.
- **Pagamento recusado:** `CANCELADO`, o estoque volta, e o app oferece montar o carrinho de novo.
- **O Mercado Pago está fora do ar ao criar o pedido:** 502 "Pagamento indisponível agora; tente em
  instantes". Nenhum pedido fica criado sem preferência.
- **O token do vendedor venceu e a renovação falhou:** 409 "Vendedor sem pagamento ativo", e o
  vendedor é avisado.
- **Webhook com assinatura inválida:** 401, log de alerta, nada muda.
- **Valor ou recebedor divergente:** nada muda, log de alerta e pedido marcado para revisão do
  ADMIN.

## 10. Integrações

- **Sistema externo:** Mercado Pago (API REST `api.mercadopago.com`, Checkout Pro, OAuth, webhook).
- **SDK:** o SDK Node oficial (`mercadopago`) **ou** `fetch` nativo do Node.
  - O blueprint decide. O `fetch` evita dependência nova, mas a validação de assinatura precisa
    seguir exatamente a documentação.
  - Dependência nova só com aprovação e `npm view`.
- **App:** o retorno do Checkout Pro ao app usa deep link `agrotech://pagamento/...`; o `app.json`
  já declara `"scheme": "agrotech"` (`apps/mobile/app.json:7`).
  - Abrir numa aba do navegador pede o `expo-web-browser` `[NOVO]` (aprovação e `npm view`). A
    alternativa sem dependência é `Linking.openURL`.
- **Pré-requisito de infraestrutura, que bloqueia produção e teste de ponta a ponta:**
  - O webhook, o retorno do OAuth e as `back_urls` precisam de **URL pública HTTPS**; o Mercado
    Pago não aceita `localhost`.
  - Isso depende da decisão de deploy da API, ainda aberta. Antes dela, o teste de ponta a ponta
    usa um túnel temporário, que é ferramenta nova e precisa de aprovação.
- **Teste:**
  - credenciais de teste e contas de teste do Mercado Pago (comprador e vendedor);
  - a documentação avisa que pagamento criado com credencial de teste **não** envia notificação, e
    por isso o sync do RF-04 também é o caminho de teste.
  - Nos testes automatizados, o Mercado Pago é simulado por um servidor HTTP local, nunca chamado de
    verdade.
- **Tratamento de falha:** timeout de 10 s nas chamadas ao Mercado Pago. Criar pedido que falha não
  deixa reserva nem pedido. Consulta que falha depois do 200 do webhook é recuperada pela varredura
  (RF-04).
- **Plugin oficial do Mercado Pago para Claude Code** (`mercadopago@mercadopago-claude-marketplace`
  v4.3.2, instalado no escopo do usuário em 2026-11-12):
  - o desenho segue os guias dele de marketplace (contrato `checkout-pro`), Checkout Pro e
    webhooks;
  - na implementação, `/mp-test-setup` cria os usuários de teste (comprador e vendedor) e
    `/mp-test-cards BR` dá os cartões de teste;
  - o MCP do plugin registra o webhook (`save_webhook`) e confere as entregas
    (`notifications_history`);
  - `/mp-review marketplace` roda antes de trocar para credencial de produção;
  - o validador `validate-marketplace-integration.mjs` procura marcações `data-mp-*` no HTML, e
    por isso vale para a web; o app React Native é conferido pelos testes deste repositório;
  - o MCP pede login OAuth na conta Mercado Pago (`/mp-connect`), feito pelo dono da conta numa
    sessão interativa.

## 11. Contratos

### Formato novo no `db.json` `[NOVO]`

```text
orders[] (campos novos, só em pedido do Mercado Pago):
  paymentStatus: 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO' | 'ESTORNADO'
  status: texto da tela ('Aguardando pagamento' | 'Pedido Confirmado' | 'Cancelado' | 'Estornado')
  sellerEmail, marketplaceFeeCents, reservedUntil, paymentReview?: { reason, paymentId, at }
  payment: { provider: 'mercadopago', preferenceId, paymentId?, mpStatus?, method?,
             checkoutUrl, history: [{ at, from, to, source }] }
sellerAccounts[]: { userId, email, mpUserId, accessTokenEnc, refreshTokenEnc, expiresAt, scope,
                    connectedAt, status: 'CONECTADA' | 'DESCONECTADA' }
oauthStates[]: { state, userId, codeVerifier, expiresAt }          // uso único, vence em 10 min
sponsorshipPlans[]: { id, days, priceCents, active }
sponsorships[] (spec 09, campos novos):
  status também 'PENDENTE' | 'CANCELADA'; origem: 'manual' | 'mercadopago'; payment: {...}
settings: { marketplaceFeePercent }
```

### API

As mudanças entram em `.ai/specs/05-openapi-spec.md` no PR de implementação, antes do código:

- `POST /api/orders`: passa a devolver `paymentStatus: 'AGUARDANDO_PAGAMENTO'` e
  `payment.checkoutUrl`. Novos erros: 400 (vários vendedores), 409 (vendedor sem conta conectada),
  502 (Mercado Pago indisponível).
- `POST /api/orders/:id/sync`: dono ou ADMIN; consulta o pagamento e devolve o pedido.
- `POST /api/orders/:id/cancel`: dono, só em `AGUARDANDO_PAGAMENTO` (parte das telas).
- `POST /api/payments/webhook`: pública, com assinatura obrigatória.
- `POST /api/mp/connect`: vendedor; grava o state e devolve a URL de autorização do Mercado Pago.
  É `POST` porque grava (o state) e assim passa pela fila de escrita.
- `GET /api/admin/settings` e `PUT /api/admin/settings`: comissão (ADMIN).
- `GET /api/mp/callback`: retorno do OAuth (`code`, `state`).
- `DELETE /api/mp/connect`: desconecta.
- `GET /api/mp/status`: `{ connected, expiresAt }`, sem token.
- `POST /api/sponsorships`: vendedor; anúncio e plano, devolve `checkoutUrl`.
- `GET /api/sponsorship-plans`: pública.
- ADMIN:
  - `PUT /api/admin/sponsorship-plans`;
  - `PUT /api/admin/settings` (comissão);
  - `POST /api/admin/orders/:id/refund`;
  - `POST /api/admin/sponsorships/:id/refund`.
- `GET /api/app-config`: ganha `payments`.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Sem deploy público, não há webhook nem OAuth | Modo simulado continua; decidir a hospedagem antes do RF-01; túnel só para teste |
| Token do vendedor vazado dá acesso à conta Mercado Pago dele | Cifrado em repouso, nunca em resposta nem em log; desconectar apaga |
| Webhook forjado marca pedido como pago | Assinatura obrigatória e consulta ao Mercado Pago como fonte de verdade, conferindo valor e recebedor |
| Estoque preso por pedido abandonado | Reserva com vencimento e varredura |
| A API de Orders do Mercado Pago substitui a de preferências | O guia de marketplace do plugin oficial (2026-08-21) manda usar preferências no Checkout Pro com split e não forçar Orders; a chamada fica isolada num único módulo |
| Webhook respondido com 200 e consulta que falha depois | A varredura reconsulta pendentes pelo `external_reference`; o sync do app cobre o retorno |
| `db.json` guardando dinheiro e tokens | Aceitável só na fase de teste; a migração para o PostgreSQL da spec 06 vem antes de vender de verdade em escala |
| Vendedor sem conta Mercado Pago ou sem cadastro completo não consegue receber | Anúncio aparece sem botão de compra, com aviso ao vendedor |

## 13. Validação

- **Como será validado:**
  - testes de domínio (comissão, extrato, estados);
  - testes de API com banco descartável e Mercado Pago simulado por servidor local;
  - fumaça com credenciais e contas de teste do Mercado Pago, via sync.
- **Evidência esperada:** cada RF só vira ✅ com `arquivo:linha` e teste, no blueprint
  `docs/tasks/{issue}-mercado-pago/blueprint.md`.
- **Ordem sugerida:**
  1. modo simulado e estados do pedido;
  2. webhook e assinatura;
  3. patrocínio (RF-06);
  4. OAuth do vendedor;
  5. pedido com split;
  6. estorno.

## 14. Questões em aberto (decisão de negócio)

- Percentual de comissão inicial.
- Tabela de planos de patrocínio (dias e preços).
- Hospedagem pública da API: bloqueia produção, OAuth e webhook.
- Política de cancelamento pelo comprador depois de pago (hoje: só o ADMIN estorna).

## Fontes consultadas (documentação oficial do Mercado Pago, 2026-11-12)

- Split de pagamentos (`marketplace_fee` no Checkout Pro, ordem das taxas, reembolso proporcional):
  https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- Notificações de pagamento (corpo, prazo de 22 s, reenvio, credencial de teste sem notificação):
  https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications
- Webhooks e `x-signature`:
  https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- OAuth (validade de 180 dias, `offline_access`, troca do `refresh_token`, PKCE):
  https://www.mercadopago.com.br/developers/en/docs/security/oauth/renewal
- Plugin oficial do Mercado Pago para Claude Code, guias `marketplace.md`, `checkout-pro.md` e
  `webhooks.md` da skill `mp-integrate` (v4.3.2):
  https://github.com/mercadopago/mercadopago-claude-marketplace
- Migração para a API de Orders (sem equivalente documentado ao `application_fee`):
  https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders
