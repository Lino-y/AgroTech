# Blueprint: app mobile com comprar, vender e financeiro (#62, Fase 2 da spec 08)

Spec: issue #62 e `.ai/specs/08-migracao-react-native.md` (Fase 2: fluxos verticais).
Base: `docs/tasks/62-apk-android/blueprint.md` (APK, login, catálogo, offline). Esta etapa vem num PR
empilhado sobre o #82.

## 1. Dor do usuário

No APK só dava para ver o catálogo: não era possível comprar, anunciar nem ver o financeiro. A web já
faz tudo isso contra a mesma API.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Navegação por abas (Catálogo, Carrinho, Vender, Financeiro, Conta) com pilha de telas; o botão voltar do Android desempilha e, no catálogo, fecha o app | teste | ✅ | `apps/mobile/src/lib/navigation.ts:44`, `apps/mobile/src/App.tsx:50`, `apps/mobile/__tests__/navigation.test.ts:12` |
| CA02 | Vender, Financeiro, Pedidos e finalizar compra pedem conta; depois do login o app volta ao destino, com o motivo da web | teste | ✅ | `apps/mobile/src/lib/navigation.ts:19`, `apps/mobile/src/App.tsx:86`, `apps/mobile/__tests__/navigation.test.ts:21` |
| CA03 | Sessão que cai no servidor (401) volta o app a visitante, sem ficar "logado" na tela | teste | ✅ | `apps/mobile/src/services/api.ts:58`, `apps/mobile/src/App.tsx:39`, `apps/mobile/__tests__/api.test.ts:113` |
| CA04 | Comprar: detalhe do produto com quantidade, carrinho com cupom e resumo pela regra compartilhada (`calculateCartSummary`, `validateCouponCode`) | teste + fumaça contra a API | ✅ | `apps/mobile/src/screens/ProductDetailScreen.tsx:64`, `apps/mobile/src/lib/cart.ts:39`, `apps/mobile/src/screens/CartScreen.tsx:49`, `apps/mobile/__tests__/cart.test.ts:46` |
| CA05 | Finalizar compra manda só id e quantidade com `Idempotency-Key` (a mesma chave nas novas tentativas do mesmo carrinho); o total que vale é o do servidor | teste + fumaça contra a API | ✅ | `apps/mobile/src/screens/CartScreen.tsx:68`, `apps/mobile/src/screens/CartScreen.tsx:43`, `apps/mobile/src/services/orders.ts:34`, `apps/mobile/__tests__/services.test.ts:31`, `apps/mobile/__tests__/cart.test.ts:41` |
| CA06 | Meus pedidos: lista da conta com status, itens, rastreio e total | fumaça contra a API | ✅ | `apps/mobile/src/screens/OrdersScreen.tsx:22` |
| CA07 | Vender: anunciar com categoria do domínio, preço no formato brasileiro, estoque inteiro; "Minha Loja" lista e exclui os anúncios da conta | teste + fumaça contra a API | ✅ | `apps/mobile/src/screens/SellScreen.tsx:58`, `apps/mobile/src/screens/SellScreen.tsx:36`, `apps/mobile/src/screens/SellScreen.tsx:85`, `apps/mobile/src/lib/sell.ts:10`, `apps/mobile/__tests__/sell.test.ts:6`, `apps/mobile/__tests__/services.test.ts:56` |
| CA08 | Financeiro: receitas, despesas, saldo, gráfico de 6 meses e extrato por `summarizeFinance`; lançamento manual | teste + fumaça contra a API | ✅ | `apps/mobile/src/screens/FinanceScreen.tsx:47`, `apps/mobile/src/screens/FinanceScreen.tsx:64`, `apps/mobile/__tests__/services.test.ts:70` |
| CA09 | Conta: visitante vê Entrar e Criar conta; logado vê dados, pedidos e Sair | leitura do código | 🟡 | `apps/mobile/src/screens/AccountScreen.tsx:46`; não visto em aparelho |
| CA10 | As regras vêm de `packages/domain`, sem cópia no app | bundle | ✅ | `apps/mobile/src/domain.ts:3`, `apps/mobile/metro.config.js:7`, `packages/domain/catalog.js:2`; bundle com as mensagens de cupom do domínio |

## 3. Contratos (antes do código)

Nenhum endpoint novo nem alterado (spec 05): `POST`/`GET /api/orders` (com `Idempotency-Key`),
`POST`/`DELETE /api/products`, `GET`/`POST /api/finance/entries`. O servidor calcula preço e total
pelo catálogo; o app manda só `{ id, quantity }`.

`packages/domain/catalog.js` passa a exportar `CATEGORY_STYLES` (a mesma tabela que já existia dentro
de `getProductCategoryStyle`), para o seletor de categoria do app.

## 4. Decisões técnicas

- **Domínio compartilhado direto (ADR-0002):** o Metro observa `packages/` (`metro.config.js`) e o app
  importa por um único arquivo (`src/domain.ts`). Tipos: `allowJs` no `tsconfig` do app lê o JSDoc
  (`// @ts-check`) do domínio sob o TypeScript estrito; não foi preciso `tsc --emitDeclarationOnly`.
- **Sem `@react-navigation`:** a navegação é estado puro (`src/lib/navigation.ts`) mais o
  `BackHandler` do React Native. A biblioteca pede dependências nativas novas e outra rebuild longa;
  trocar quando houver deep link ou animação de tela. (O blueprint anterior e a ADR-0001 citam a
  biblioteca.)
- **Carrinho em memória:** guardar entre aberturas do app é a Fase 3 (offline controlado).
- **Pagamento simulado, como na web:** escolhe PIX, boleto ou cartão, mas nada vai para o servidor e o
  app nunca pede dado de cartão (ADR-0001).
- **Sem foto no anúncio:** `expo-image-picker` traz permissões de câmera e galeria (o APK hoje só
  pede internet) e mais uma dependência nativa. O servidor escolhe emoji e cor pela categoria.
- **Chave de idempotência com `Math.random`:** o Hermes não garante `crypto.randomUUID`; a chave não é
  segredo, só reconhece reenvio do mesmo usuário.

## 5. Must have

- CA01 a CA08 e CA10.

## 6. Nice to have

- Favoritos, avaliações, suporte e o preenchimento por IA do anúncio (existem na web).

## 7. Fonte de verdade em caso de divergência

A spec 08 manda no escopo das fases; este blueprint manda no "como".

## 8. Divergências / achados durante a implementação

- **Fase 2 antes da Fase 3 e do ADR-0001 aceito:** o dono pediu comprar, vender e financeiro no APK.
- **Rastreio e suporte (item 6 da Fase 2) não entram:** o app mostra o código de rastreio e o prazo do
  pedido, mas não a linha do tempo nem o chat de suporte.
- **Fumaça contra a API real:** os serviços do app rodaram no Node contra uma API numa porta separada
  com cópia do banco (login, pedido, reenvio com a mesma chave devolvendo o mesmo pedido, pedidos,
  anunciar, Minha Loja, excluir, extrato, lançamento manual). O total do servidor bateu com o da tela
  (R$ 412,73). As telas não foram vistas em aparelho.

### 8.1 Evidência do APK 0.2.0

Arquivo: `C:\Users\Rooselt\AgroTech-APK\agrotech-0.2.0.apk` (substitui o 0.1.5), 67.401.370 bytes,
SHA-256 `c2a5ea1364b6a7b330c0d69f6d228b2264f4d1419970f714b3db56516fbaa13b`.

- `aapt2 dump badging`: `versionCode` 7, `versionName` 0.2.0, permissão `INTERNET` apenas.
  `apksigner verify`: válido (chave de depuração).
- Bundle extraído do APK: contém as mensagens de cupom de `packages/domain`, as telas de compra,
  anúncio, financeiro e pedidos, o `Idempotency-Key` e o endereço `192.168.1.34:3001`.
- Build numa pasta que espelha o repositório (`C:\b\apps\mobile` e `C:\b\packages\domain`):
  `BUILD SUCCESSFUL` em 9 min 53 s. Testes do app: 54 de 54; suíte do raiz: 226 de 226.
- Não visto em aparelho.
