# Blueprint: offline controlado no app (#62, Fase 3 da spec 08)

Spec: issue #62, `.ai/specs/08-migracao-react-native.md` (Fase 3, RN04 a RN06) e a política offline da
`docs/adr/0001-migracao-para-react-native.md`. PR empilhado sobre o de estilo
(`docs/tasks/62-app-estilo/blueprint.md`).

## 1. Dor do usuário

Sem internet, só um catálogo fixo de demonstração funcionava: o carrinho sumia ao fechar o app e
pedidos e extrato davam erro.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Sem rede, o catálogo abre com o último catálogo consultado, com data e hora e o aviso de que pode estar desatualizado; sem nenhum salvo, o de demonstração | teste + reconexão no serviço | ✅ | `apps/mobile/src/lib/catalog.ts:86`, `apps/mobile/src/screens/CatalogScreen.tsx:56`, `apps/mobile/__tests__/offline-rules.test.ts:29` |
| CA02 | O catálogo salvo é enxuto: sem comentários, sem dono, sem foto em base64 | teste | ✅ | `apps/mobile/src/lib/catalog.ts:75`, `apps/mobile/__tests__/offline-rules.test.ts:9` |
| CA03 | O carrinho fica guardado no aparelho (fecha e abre o app) e leva só produto e quantidade | teste | ✅ | `apps/mobile/src/App.tsx:36`, `apps/mobile/src/App.tsx:54`, `apps/mobile/src/lib/cart.ts:78`, `apps/mobile/__tests__/offline-rules.test.ts:73` |
| CA04 | Antes do pedido o carrinho é revalidado com o catálogo atual (preço, produto removido, estoque); se algo mudou, mostra e para | teste | ✅ | `apps/mobile/src/lib/cart.ts:54`, `apps/mobile/src/screens/CartScreen.tsx:76`, `apps/mobile/__tests__/offline-rules.test.ts:52`, `apps/mobile/__tests__/offline-rules.test.ts:64` |
| CA05 | Pedido nunca é feito sem rede (ADR-0001) | reconexão no serviço | ✅ | `apps/mobile/src/screens/CartScreen.tsx:92`; seção 8 |
| CA06 | Sem rede, pedidos e extrato mostram o último dado salvo, com a data; com rede, gravam | teste | ✅ | `apps/mobile/src/services/offline.ts:10`, `apps/mobile/src/screens/OrdersScreen.tsx:25`, `apps/mobile/src/screens/FinanceScreen.tsx:39`, `apps/mobile/__tests__/cache.test.ts:86` |
| CA07 | Dado pessoal salvo (pedidos, extrato) tem dono e some ao sair da conta ou na sessão expirada; catálogo e carrinho ficam | teste | ✅ | `apps/mobile/src/services/storage.ts:42`, `apps/mobile/src/services/storage.ts:97`, `apps/mobile/__tests__/cache.test.ts:40`, `apps/mobile/__tests__/cache.test.ts:67` |
| CA08 | Modo offline conferido em aparelho (modo avião) | aparelho | 🔴 | não feito: sem aparelho neste PC |

## 3. Contratos (antes do código)

Nenhum endpoint novo (spec 05). Formato salvo no aparelho (AsyncStorage), uma chave por dado:
`{ savedAt: ISO, owner: id do usuário | null, data }`. Chaves: `cache:catalog` e `cart` (sem dono),
`cache:orders` e `cache:finance` (dono = usuário da sessão).

## 4. Decisões técnicas

- **Armazenamento:** `@react-native-async-storage/async-storage` 2.2.0, a versão que o Expo 58 fixa
  (`npm view` conferido). É injetado como o armazenamento seguro (`setKeyValueStore`), então os testes
  rodam no Node sem módulo nativo. O token continua no armazenamento seguro, separado do cache.
- **Limpeza num lugar só:** `clearSession` apaga pedidos e extrato salvos; sair da conta e o 401 já
  passam por ele. A leitura também confere o dono, contra resto de outra conta.
- **Só falta de rede usa cache** (status 0). Erro do servidor mostra o erro.
- **Revalidação no checkout, não ao abrir o carrinho:** se mudou, atualiza e para; a pessoa toca de
  novo. Enviar no mesmo toque mandaria a chave de idempotência antiga com outro carrinho (409).
- **Sem fila de envio:** anunciar e lançar no financeiro não têm chave de idempotência no servidor, e a
  spec 08 só permite fila para ação idempotente e não financeira. Ficam só online.
- **Sem validade nem sincronização em segundo plano:** a data e o aviso de desatualizado são o que a
  ADR-0001 pede.

## 5. Must have

- CA01 a CA07.

## 6. Nice to have

- Fila para anunciar sem rede (pede `Idempotency-Key` em `POST /api/products`).

## 7. Fonte de verdade em caso de divergência

A ADR-0001 (política offline) e a spec 08 mandam no "o quê"; este blueprint, no "como".

## 8. Divergências / achados durante a implementação

- **O servidor não confere estoque no pedido** (`POST /api/orders`): o app limita a quantidade quando o
  produto traz `stock`, mas os produtos de demonstração não trazem. Conferir estoque é do servidor.
- **Teste de reconexão na camada de serviço:** os serviços do app rodaram no Node contra uma API real
  descartável (porta 3998, cópia do banco). Online: catálogo, pedidos e extrato gravados. Depois a API
  foi derrubada: pedidos e extrato vieram do aparelho com a data, o catálogo veio do último salvo, o
  carrinho voltou só com produto e quantidade, o pedido ficou bloqueado por falta de rede, e sair da
  conta apagou pedidos e extrato salvos (o catálogo ficou). No aparelho ainda não (CA08).
