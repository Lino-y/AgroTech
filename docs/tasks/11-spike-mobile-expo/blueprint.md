# Blueprint: spike mobile React Native + Expo (issue #11)

> Fase 0 da spec 08 (`.ai/specs/08-migracao-react-native.md`). Toda decisão cita
> `arquivo:linha` de código real lido ou está marcada como `[NOVO]`.

## 1. Dor do usuário

O produto é mobile-first, mas hoje só existe a SPA web. Antes de criar o app
completo, a issue #11 pede um spike pequeno que prove a stack (React Native +
Expo, TS estrito) e o padrão de sessão (token, 401, storage) seguindo o
referencial `mais-frota/apps/mobile-driver`.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Spike executa em Android e iOS | `expo run:android\|ios` | 🟡 | Código pronto para Expo (`apps/mobile-spike/app/index.tsx`), mas instalar Expo antes do gate da ADR-0001 fere o próprio gate; build fica para a Fase 1 |
| CA02 | Token é anexado e removido corretamente | teste do serviço | ✅ | `apps/mobile-spike/app/services/api.ts:35` (Bearer) e `apps/mobile-spike/app/services/storage.ts:37` (clearSession) — teste: `apps/mobile-spike/__tests__/session.test.ts:26` |
| CA03 | 401 encerra a sessão local | teste do serviço | ✅ | `apps/mobile-spike/app/services/api.ts:55` (401/403 → `clearSession`) — testes: `apps/mobile-spike/__tests__/session.test.ts:65` e `apps/mobile-spike/__tests__/session.test.ts:119` (revisão: falha de rede não desloga) |
| CA04 | TypeScript estrito e testes passam | `tsc -p` + `node --test` | ✅ | `apps/mobile-spike/tsconfig.json:5` (`"strict": true`); 7/7 testes verdes em `apps/mobile-spike/__tests__/session.test.ts:26-136` |
| CA05 | ADR registra seguir, ajustar ou cancelar | seção na ADR | ✅ | `docs/adr/0001-migracao-para-react-native.md:146` — "Resultado do spike": recomendação **seguir** (a decisão vale só com o gate aprovado) |
| CA06 | Política offline respeita a spec 08 | tabela da ADR | ✅ | Nenhuma ação financeira no spike; falha de rede preserva sessão com erro tipado — teste `apps/mobile-spike/__tests__/session.test.ts:101` |

## 3. Contratos (antes do código)

- Endpoint consumido: `GET /api/auth/me` — auth: `authenticate`
  (`server.js:424`) — response `{ user }`. Sem endpoint novo: OpenAPI
  (`.ai/specs/05-openapi-spec.md`) não muda.
- Função pública `[NOVO]`: `apiRequest<T>(path, options)` em
  `apps/mobile-spike/app/services/api.ts` — token de `getSession()`, timeout
  via `AbortController`, `ApiError` tipado, 401/403 → `clearSession()`.
- Função pública `[NOVO]`: `getSession/setSession/clearSession/setSecureStore`
  em `apps/mobile-spike/app/services/storage.ts` — sessão única, secure store
  injetável, fallback em memória.
- Testes que provam cada critério: `apps/mobile-spike/__tests__/session.test.ts`
  (7 casos, incluindo sessão expirada e timeout).

## 4. Decisões técnicas

- Sem instalar Expo no spike: o gate de aprovação da ADR-0001 proíbe instalar
  Expo antes da aprovação; o spike valida o desenho com TS estrito + testes,
  e o build Android/iOS (CA01) entra na Fase 1 imediatamente após o merge.
- TS estrito com `allowImportingTsExtensions` para rodar direto no Node
  (`node --experimental-strip-types --test`), sem bundler nem dependência nova.
- Secure store injetável em vez de `import` direto do `expo-secure-store`:
  permite testar storage sem dependência nativa.
- Nada em `src/` foi alterado — a SPA segue intacta (RN08).

## 5. Must have

- [x] Cliente HTTP centralizado com token e timeout (`apps/mobile-spike/app/services/api.ts:30`) — testes `apps/mobile-spike/__tests__/session.test.ts:26` e `:119`
- [x] 401/403 encerra sessão local (`apps/mobile-spike/app/services/api.ts:55` + `apps/mobile-spike/app/services/storage.ts:37`) — testes `apps/mobile-spike/__tests__/session.test.ts:65` e `:88`
- [x] Storage de sessão isolado (`apps/mobile-spike/app/services/storage.ts:18`) — teste `apps/mobile-spike/__tests__/session.test.ts:136`
- [x] Tela autenticada mínima (`apps/mobile-spike/app/screens/HomeScreen.tsx:15`) consumindo `/api/auth/me` via `apps/mobile-spike/app/services/api.ts:73`
- [x] Teste de sessão expirada (`apps/mobile-spike/__tests__/session.test.ts:65`)
- [x] Recomendação registrada na ADR-0001 (`docs/adr/0001-migracao-para-react-native.md:146` — seguir; a decisão depende do gate)
- [x] Status RN01–RN08 atualizado na spec 08 (`.ai/specs/08-migracao-react-native.md:131-138`)

## 6. Nice to have

- [ ] Build Expo Android/iOS (Fase 1, pós-gate)

## 7. Fonte de verdade em caso de divergência

Spec 08 e issue #11 mandam no "o quê"; este blueprint no "como". Divergência
encontrada: a issue pede "build Android/iOS" no spike, mas a ADR-0001 veda
instalar Expo antes do gate — registrado como 🟡 em CA01 com o motivo, não
resolvido em silêncio.

## 8. Divergências / achados durante a implementação

- CORS aberto no `server.js:312` aceitará o cliente nativo sem restrição;
  sinalizado na ADR como risco para a Fase 4 (rollout).
- **Revisão (spec-code-review):** a `HomeScreen.tsx` limpava a sessão em
  qualquer erro, incluindo falha de rede — contrariava a política offline
  (ADR: "falha de rede preserva a sessão") e o próprio teste. Corrigido:
  só `ApiError` com status 401/403 desloga (`app/screens/HomeScreen.tsx:29-35`),
  com teste novo cobrindo o status 0 de rede (`session.test.ts:119`).
