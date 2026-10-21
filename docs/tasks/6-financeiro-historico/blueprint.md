# Blueprint: dashboard financeiro ligado ao histórico persistido de compras (#6)

> O "o quê" é a issue #6. Este documento é o "como".
> As referências das seções 1, 3 e 4 apontam para o código de `origin/main` em
> `8d3f86d`, lido antes de escrever (o que ainda não existe está marcado `[NOVO]`).
> As evidências das seções 2 e 5 apontam para o código depois da mudança.

## 1. Dor do usuário

A tela financeira soma tudo em memória (`state.finance`, `src/modules/catalog.js:78`):
recarregar a página zera o saldo e o extrato, embora os pedidos estejam gravados no
`db.json`. E os números não batem entre si: a compra entra duas vezes no gráfico, pelo
pedido (`src/modules/catalog.js:121`) e pelo lançamento local (`src/modules/catalog.js:128`),
mas só uma vez no card de saídas (`src/modules/catalog.js:916`).

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Compra aprovada aparece no histórico financeiro | teste de API: o pedido criado aparece em `GET /api/finance/entries` do comprador (saída) e do vendedor (entrada); navegador | 🔴 | |
| CA02 | Recarregar não apaga lançamentos válidos | teste de API: lançamento manual continua no GET depois de outra gravação no banco; navegador: recarregar a página e reabrir o financeiro | 🔴 | |
| CA03 | Totais e gráfico usam a mesma fonte | teste unitário: a soma das barras é o total dos cards em cada período | 🔴 | |
| CA04 | Filtros por período e tipo mantêm totais coerentes | teste unitário: o período recorta cards, gráfico e extrato; o tipo recorta o extrato, que soma o card do mesmo tipo | 🔴 | |
| CA05 | Usuários não acessam lançamentos de outra conta | teste de API: terceiro recebe `[]`, lançamento manual só volta para o dono, 401 sem token; teste da carga: resposta atrasada de outra sessão não sobrescreve o extrato | 🔴 | |
| CA06 | Testes cobrem vazio, receita e filtro | `tests/finance.test.js` | 🔴 | |

Status: ✅ feito · 🟡 parcial · ⚠️ divergente · 🔴 não feito.

## 3. Contratos (antes do código)

- Endpoint `GET /api/finance/entries` `[NOVO]` — auth: `authenticate` — response
  `200 FinanceEntry[]`, do mais recente ao mais antigo, só da conta da sessão (ADMIN
  incluso) — erros: `401 { message }`.
- Endpoint `POST /api/finance/entries` `[NOVO]` — auth: `authenticate` — request
  `{ title: string, amount: number, type: 'INCOME' | 'EXPENSE' }` — response
  `201 FinanceEntry` com `source: 'MANUAL'` — erros: `400 { message }` (descrição vazia,
  valor que não é maior que zero, tipo fora da lista), `401`. Descrição passa por
  `cleanText` (`server.js:233`) e é cortada em 120 caracteres.
- `FinanceEntry` `[NOVO]`: `{ id: string, type: 'INCOME' | 'EXPENSE',
  source: 'COMPRA' | 'VENDA' | 'MANUAL', title: string, amount: number,
  date: string (ISO) | null }`.
- `POST /api/orders` (`server.js:527`): o pedido novo ganha `createdAt` (ISO) `[NOVO]`.
  O `date: 'Hoje'` (`server.js:544`) fica como está, porque a tela de pedidos o mostra.
- `src/data/db.json`: lista nova `financeEntries` `[NOVO]`, padrão `[]`, com itens
  `{ id, ownerEmail, type, title, amount, createdAt }`. Entra no `defaultDb`
  (`server.js:28`), na normalização de `ensureDbFile` (`server.js:196`) e no retorno de
  `readDb` (`server.js:214`): hoje os dois montam o banco só com `users`, `products` e
  `orders`, e qualquer outra lista some na primeira leitura.
- `src/services/finance.js` `[NOVO]`, com `// @ts-check`:
  - `buildFinanceEntries({ orders, financeEntries }, email) → FinanceEntry[]`, usada pelo
    `server.js` como já acontece com `calculateCartSummary` (`server.js:11`);
  - `summarizeFinance(entries, { months, type, now }) → { income, expense, balance,
    chart, entries, purchases }`, usada pela tela.
- `src/modules/finance-sync.js` `[NOVO]`, com `// @ts-check`:
  `syncFinance(state, { load, render }) → Promise<void>`, no molde de `syncCatalog`
  (`src/modules/catalog-sync.js:12`).
- `src/services/api.js`: `loadFinanceEntries()` e `createFinanceEntry(payload)` `[NOVO]`,
  pelo `apiRequest` (`src/services/api.js:3`).
- Testes em `tests/finance.test.js` `[NOVO]`, com o `server.js` de verdade num banco
  descartável (`DATA_FILE`), como em `tests/api.test.js`:
  - vazio: totais zerados e gráfico com os meses do período (CA06);
  - receita: venda é o item do vendedor no pedido de outra conta, sem auto-compra (CA06);
  - filtro: período e tipo, soma das barras e do extrato contra os cards (CA03, CA04, CA06);
  - compra aprovada no extrato do comprador e do vendedor; terceiro vê vazio (CA01, CA05);
  - lançamento manual gravado, que sobrevive a outra gravação e só o dono vê (CA02, CA05);
  - lançamento manual inválido recusado;
  - carga da tela: "carregando" sem lançamento antigo, erro, resposta atrasada (CA05).

## 4. Decisões técnicas

- **Compra aprovada = pedido criado com sucesso em `POST /api/orders`.** Decisão do
  usuário, enquanto a #5 (estados de pagamento) não existe. Ref: `server.js:527`.
- **Uma fonte só, montada no servidor.** O extrato vem de `GET /api/finance/entries`, que
  deriva os lançamentos de `db.orders` e de `db.financeEntries`. A tela não soma nada em
  memória: cards, gráfico, extrato e o card "Compras na AgroTech" saem de
  `summarizeFinance` sobre a mesma lista, e os totais são a soma das barras do gráfico.
  Motivo: hoje são duas fontes (`state.finance` e `state.orders`) que divergem.
  Ref: `src/modules/catalog.js:121`, `src/modules/catalog.js:128`,
  `src/modules/catalog.js:1821`.
- **Receita (entrada) = venda.** Item de pedido de outra conta cujo produto é da conta
  (cada item guarda a cópia do produto, com `ownerEmail`), pelo valor bruto
  preço × quantidade, mais o lançamento manual "Venda (Entrada)". Comprar o próprio
  produto não vira venda. Motivo: a tela chama a entrada de "Vendas (Entradas)" e o
  formulário de "Venda (Entrada)"; o RF01 separa Comprador de Vendedor; e qualquer conta
  pode anunciar. Teto: cupom e frete são do pedido e não descontam da receita do vendedor.
  Ref: `src/modules/catalog.js:1834`, `src/modules/catalog.js:1863`,
  `.ai/specs/02-requisitos-funcionais.md:3`, `server.js:538`, `server.js:398`.
- **Despesa (saída) = compra da conta**, pelo total que o servidor calculou, mais a saída
  manual. Ref: `server.js:539`.
- **Lançamento manual passa a ser gravado no servidor.** Hoje ele vive só em memória e
  some ao recarregar, o que fere o CA02. Ref: `src/modules/catalog.js:956`.
- **Data do lançamento.** `createdAt` no pedido novo e no lançamento manual. Pedido
  antigo usa a data legível do seed ("15/Set/2026", mesma leitura de `parseOrderDate`).
  Pedido antigo gravado com "Hoje" não tem data real: fica fora do financeiro (só existe
  em banco local de desenvolvimento). Ref: `server.js:544`, `server.js:118`,
  `src/modules/catalog.js:141`.
- **Filtros.** Período: mês atual, 3 meses ou 6 meses (padrão 6, a janela que o gráfico
  já mostra). Tipo: Todas, Entradas, Saídas (os chips que já existem). O período recorta
  tudo; o tipo recorta só o extrato, para o saldo continuar sendo saldo. Só conta o
  lançamento cujo mês está no gráfico, então barras e cards batem por construção. Ficou
  de fora um período "tudo": janela maior que 6 meses pede gráfico com escala dinâmica.
  Ref: `src/modules/catalog.js:108`, `src/modules/catalog.js:1815`,
  `src/modules/catalog.js:1879`.
- **Isolamento.** O GET devolve só a conta da sessão, inclusive para o ADMIN: o total da
  plataforma já existe em `GET /api/admin/summary`. Na tela, o financeiro passa a exigir
  login (a mensagem já existe em `pendingScreenNames`), cada carga começa com o extrato
  vazio e uma resposta atrasada de carga anterior não sobrescreve a atual; sair da conta
  limpa o extrato. Ref: `server.js:523`, `server.js:565`, `src/modules/catalog.js:186`,
  `src/modules/catalog.js:1181`, `src/modules/catalog.js:1107`.
- **Carga na tela.** O extrato é buscado ao abrir a tela, sem cache, então compra aprovada
  e lançamento novo aparecem na abertura seguinte. Login com tela pendente passa por
  `navigateTo`, para carregar também. Ref: `src/modules/catalog.js:184`,
  `src/modules/catalog.js:1096`.
- **Estado no front.** `state.finance` vira `{ entries, loading, error }` e entra
  `state.financePeriod`. Saem `syncFinanceChartData`, `parseOrderDate` e o lançamento
  local da compra. Ref: `src/modules/catalog.js:102`, `src/modules/catalog.js:141`,
  `src/modules/catalog.js:181`, `src/modules/catalog.js:916`.
- **Estilo.** Os chips de período e de tipo usam uma classe com tokens em
  `src/styles/ui.css` (RNF01), sem cor hex nova. Os de tipo saem do estilo inline, o que
  também tira 9 ternários de `renderFinanceScreen`, já no limite do lint.
  Ref: `src/styles/ui.css:1`, `src/modules/catalog.js:1879`.
- **Gráfico sem mudança.** `renderFinanceChart` já recebe `{ month, income, expense }`.
  Ref: `src/components/FinanceChart.js:7`.

## 5. Must have

- [ ] `GET` e `POST /api/finance/entries`, com validação e só a conta da sessão.
- [ ] `createdAt` no pedido novo e lista `financeEntries` preservada pelo `readDb`.
- [ ] `buildFinanceEntries` e `summarizeFinance` em `src/services/finance.js`.
- [ ] `syncFinance` em `src/modules/finance-sync.js`.
- [ ] Tela financeira lendo o extrato do servidor, com filtro de período e de tipo.
- [ ] Testes em `tests/finance.test.js`.
- [ ] Contrato em `.ai/specs/05-openapi-spec.md`, lista nova em
  `.ai/specs/06-schema-banco-de-dados.md` e linha RF01 de
  `.ai/specs/07-tasklist-desenvolvimento.md`.

## 6. Nice to have

- [ ] Período "tudo" ou 12 meses, com gráfico de escala dinâmica.
- [ ] "Meus Pedidos" carregado do servidor ao abrir o app (ver seção 8).
- [ ] Data legível do pedido na tela de pedidos a partir de `createdAt` (hoje mostra
  "Hoje" para sempre).

## 7. Fonte de verdade em caso de divergência

Se este Blueprint divergir do PRD/spec: o **PRD manda no "o quê"** (escopo,
critérios de aceite); este documento manda só no "como" (arquitetura,
implementação). Divergência encontrada durante a implementação vira um item
na seção abaixo, nunca é resolvida em silêncio.

## 8. Divergências / achados durante a implementação

- O RF01 é "Cadastro com perfil Comprador/Vendedor"
  (`.ai/specs/02-requisitos-funcionais.md:3`), mas a issue e a tasklist
  (`.ai/specs/07-tasklist-desenvolvimento.md:14`) ligam o dashboard financeiro ao RF01.
  Não existe RF do financeiro. Mantido o rótulo RF01; criar um RF próprio é decisão de
  produto.
- `loadOrders` (`src/services/api.js:53`) nunca é chamado: "Meus Pedidos" só mostra os
  pedidos da sessão e esvazia ao recarregar. Fora do escopo; o card "Compras na AgroTech"
  do financeiro passa a vir do extrato, e não de `state.orders`.
- Referências de linha de `catalog.js` em `docs/agents/architecture.md` e na tasklist já
  estavam defasadas antes desta mudança (ex.: `renderApp` citado na linha 2187, que hoje
  está na 2517).
