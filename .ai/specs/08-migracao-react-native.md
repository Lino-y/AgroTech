# 08 — Spec de migração mobile para React Native + Expo

- **Status:** Fase 0 executada (issue #11). Fase 1 em andamento: APK Android gerado por sideload, sem contas de loja (ADR-0001, "Decisão de distribuição"); iOS adiado; fases 2–4 pendentes
- **ADR:** `docs/adr/0001-migracao-para-react-native.md`
- **ADR da estrutura frontend/backend (aceita em 2026-11-10, issue #62):**
  `docs/adr/0002-estrutura-frontend-backend.md`
- **Padrão de referência:** `mais-frota/apps/mobile-driver`

## Objetivo

Definir uma migração faseada da experiência mobile do AgroTech para React
Native + Expo, seguindo o padrão maduro de separação entre telas, estado,
serviços, storage e fila offline já adotado no Mais Frota.

Esta spec não instala dependências nem cria o app. Ela define o contrato para
uma futura implementação.

## Estado atual comprovado

- telas e estado web: `src/modules/catalog.js`;
- acesso HTTP: `src/services/api.js`;
- regras de carrinho e comércio: `src/services/cart.js` e
  `packages/domain/commerce.js`;
- API Express: `apps/api/server.js`;
- contrato HTTP: `.ai/specs/05-openapi-spec.md`;
- testes API/serviços: `tests/api.test.js` e `tests/services.test.js`.

## Arquitetura alvo

```text
apps/mobile/
├─ app/screens/           # Login, catálogo, produto, carrinho, checkout, pedidos
├─ app/components/        # UI sem regra de negócio
├─ app/navigation/        # stack, tabs e proteção de rotas
├─ app/store/             # auth, catalog, cart, orders, support
├─ app/services/api.ts    # cliente HTTP e autenticação
├─ app/services/storage.ts# sessão, cache e fila
├─ app/utils/offlineQueue.ts
├─ app/domain/            # cálculo de carrinho, cupons e normalização
├─ app/types/             # tipos dos contratos
└─ __tests__/
```

### Estrutura do repositório (ADR-0002, aceita)

```text
apps/api/        # backend Express: server.js, ids, write-queue e o banco em data/ (feito no A2)
apps/web/        # SPA legada (hoje index.html, src/ e assets/ na raiz)
apps/mobile/     # o app acima
packages/domain/ # regras puras compartilhadas: commerce, finance, catalog
```

`apps/api`, `apps/web` e `apps/mobile` falam só por HTTP e importam apenas
`packages/domain`. A estrutura é aplicada passo a passo (Fase A): até cada passo
ser mesclado, o que ele move fica onde está: a API já mora em `apps/api/` (A2);
a SPA (`src/`, `assets/`, `index.html`) fica na raiz até o A3.

## Fases

### Fase 0 — spike arquitetural

- criar uma tela mínima autenticada em Expo;
- consumir `/api/auth/me` usando um cliente HTTP centralizado;
- validar armazenamento e remoção da sessão;
- validar TypeScript estrito, testes e build Android/iOS;
- registrar custo, riscos e decisão final na ADR.

### Fase A — separação frontend/backend (ADR-0002, antes da Fase 1)

Liberada pela ADR-0002 (aceita); A1 e A2 não instalam Expo nem React Native,
então não esperam a aprovação da ADR-0001. Um PR por passo, sem mudar comportamento,
com `npm run verify`, `npm run test:ui` e `npm run check:coherence` verdes:

1. **A1:** extrair `packages/domain` (commerce, finance, catalog) — **feito**:
   API (`apps/api/server.js:12`) e SPA (`src/modules/cart.js:1`) importam o mesmo
   arquivo, servido em `/packages/domain` (`apps/api/server.js:379`);
2. **A2:** mover o backend para `apps/api`, com o banco fora da pasta servida —
   **feito**: o servidor serve a SPA a partir da raiz
   (`apps/api/server.js:377` a `:379`, `apps/api/server.js:723`), `ids` e
   `write-queue` moram em `apps/api/`, o banco nasce em `apps/api/data/db.json` e
   o servidor avisa se achar o antigo em `src/data/` (`apps/api/server.js:54`);
3. **A3:** mover a SPA para `apps/web` — adiado até a aposentadoria dela.

A guarda de spec (`.ai/scripts/spec-guard.js`), o ESLint, o `jsconfig.json`, os
scripts e os testes acompanham cada movimentação (checklist na ADR-0002).

### Fase 1 — fundação

- criar `apps/mobile` somente após aprovação do spike;
- configurar navegação, tema, tratamento de erro e estados de carregamento;
- criar `api service`, `storage service` e tipos dos contratos;
- migrar primeiro as regras puras de carrinho/cupom com testes equivalentes;
- definir estado por domínio sem colocar regra de negócio em componentes.

### Fase 2 — fluxos verticais

Migrar cada fluxo completo, com tela, serviço, erro, loading, teste e rollout:

1. autenticação e logout;
2. catálogo, busca e filtros;
3. detalhe do produto e favoritos;
4. carrinho e cupons;
5. checkout e pedidos;
6. rastreio e suporte;
7. finanças, se confirmadas como prioridade mobile.

### Fase 3 — offline controlado

- cachear somente catálogo consultado e dados autorizados;
- persistir carrinho com revalidação obrigatória;
- permitir fila apenas para ações não financeiras e idempotentes;
- nunca persistir cartão nem confirmar pedido sem rede;
- testar reconexão, duplicidade, conflito e expiração de sessão.

### Fase 4 — rollout

- publicar para um grupo piloto;
- medir crashes, falhas de autenticação, conversão e pedidos duplicados;
- manter a SPA como fallback durante o piloto;
- decidir a retirada de cada fluxo web somente após evidência.

## Contratos antes do código

- endpoint novo/alterado: atualizar `.ai/specs/05-openapi-spec.md`;
- regra de negócio migrada: manter teste em `tests/` ou criar teste equivalente
  no domínio mobile;
- sessão: documentar expiração, logout, 401/403 e limpeza de storage;
- fila: documentar idempotency key, retry, backoff, conflito e descarte;
- cache: documentar TTL, versão, invalidação e estado desatualizado;
- dependência nova: justificar escolha e alternativa descartada.

## Critérios de aceite

| ID | Critério | Evidência esperada | Status |
|---|---|---|---|
| RN01 | Expo + TypeScript estrito validados no spike | ADR + build Android/iOS | 🟡 Android: APK gerado e assinado (`apps/mobile/README.md:19`; evidência em `docs/tasks/62-apk-android/blueprint.md`, seção 8.1); TS estrito em `apps/mobile/tsconfig.json:1`; iOS adiado (ADR-0001, divergência registrada) |
| RN02 | API e tipos mobile seguem o contrato existente | testes de integração | 🟡 `/api/auth/me` coberto por `apps/mobile-spike/__tests__/session.test.ts`; demais rotas na Fase 1 |
| RN03 | API service centraliza token, timeout e 401/403 | teste do serviço | ✅ `apps/mobile-spike/app/services/api.ts:30` + testes de token/401/403/timeout (`session.test.ts:26,65,88,139`) |
| RN04 | Storage isola sessão, cache e fila | testes de storage | ✅ `apps/mobile-spike/app/services/storage.ts:18` + teste de set/get/clear (`session.test.ts:156`) |
| RN05 | Carrinho offline revalida preço e estoque | teste de reconexão | 🔴 Fase 3 |
| RN06 | Nenhum cartão ou pedido financeiro entra na fila | teste de segurança | 🔴 Fase 3 (no spike nenhuma ação financeira existe) |
| RN07 | Cada fluxo migrado tem teste e rollout reversível | checklist de release | 🔴 Fase 2 |
| RN08 | SPA continua funcional durante o piloto | smoke test web | ✅ spike não toca a SPA: nenhum arquivo de `src/` alterado |
| RN09 | Regras de comércio e finanças em um único lugar (`packages/domain`), usadas por api, web e mobile | teste que falha se divergirem | 🟡 api e web usam o mesmo arquivo (`apps/api/server.js:12`, `src/modules/cart.js:1`; sem cópia: `tests/domain-boundary.test.js:22`; domínio puro: `tests/domain-boundary.test.js:10` e o lint de `packages/`); falta o mobile (Fase 1) |
| RN10 | Separação frontend/backend sem regressão | `npm run verify`, `npm run test:ui`, `npm run check:coherence` e spec-guard cobrindo as pastas novas | ✅ A1 e A2 feitos (A3 adiado pela ADR-0002): guarda de spec reconhece `packages/` e `apps/` (`.ai/scripts/spec-guard.js:16`, testes `.ai/scripts/spec-guard.test.js:31` e `.ai/scripts/spec-guard.test.js:32`), banco e servidor fora das pastas servidas (`tests/api.test.js:96`, `tests/api.test.js:97`), rota do domínio (`tests/static-guard.test.js:73`), remapeamento de referências versionado (`.ai/scripts/remap-refs.js`, teste `.ai/scripts/remap-refs.test.js:19`); `npm run verify` e `npm run test:ui` verdes |
| RN11 | Pré-requisitos de API para o app: idempotência em `POST /api/orders`, exclusão de conta, estratégia de sessão, versão mínima do app, catálogo paginado, CORS e limite de login | spec 05 atualizada + testes de API | ✅ idempotência em `apps/api/server.js:608` (chave) e `:626` (reenvio), teste `tests/orders-idempotency.test.js:47`; exclusão de conta `apps/api/server.js:490`, teste `tests/account-delete.test.js:46`; sessão: versão no token `apps/api/server.js:185`, token casa pelo id da conta `:319`, logout `:525`, teste `tests/session-revoke.test.js:50`; versão mínima `apps/api/server.js:407` e `apps/api/app-version.js:14`, teste `tests/app-config.test.js:26`; paginação `apps/api/server.js:579`, teste `tests/products-pagination.test.js:47`; CORS `apps/api/server.js:341`, limite de login `apps/api/server.js:453` e `apps/api/login-limiter.js:31`, teste `tests/cors-login.test.js:34`. Pendências: checagem `X-App-Version`/426 (quando o app existir); refresh token (decidido: 7 dias + logout) |

## Fora de escopo

- migrar a API para NestJS;
- trocar JSON por PostgreSQL ou Prisma;
- adicionar Supabase, Redis, RabbitMQ ou serviços de telemetria;
- reescrever a SPA antes de validar o cliente mobile;
- implementar pagamento offline;
- instalar React Native/Expo nesta etapa documental.
