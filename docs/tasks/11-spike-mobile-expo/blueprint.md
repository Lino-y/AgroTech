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
| CA02 | Token é anexado e removido corretamente | teste do serviço | ✅ | `apps/mobile-spike/__tests__/session.test.ts` — "anexa o token..." e "401 encerra..." |
| CA03 | 401 encerra a sessão local | teste do serviço | ✅ | `apps/mobile-spike/app/services/api.ts` (401/403 → `clearSession`) + teste |
| CA04 | TypeScript estrito e testes passam | `tsc -p` + `node --test` | ✅ | `apps/mobile-spike/tsconfig.json` (`strict`); 7/7 testes verdes |
| CA05 | ADR registra seguir, ajustar ou cancelar | seção na ADR | ✅ | `docs/adr/0001-migracao-para-react-native.md` — "Resultado do spike": **seguir** |
| CA06 | Política offline respeita a spec 08 | tabela da ADR | ✅ | Nenhuma ação financeira no spike; falha de rede preserva sessão com erro tipado (teste "sem rede...") |

## 3. Contratos (antes do código)

- Endpoint consumido: `GET /api/auth/me` — auth: `authenticate`
  (`server.js:384`) — response `{ user }`. Sem endpoint novo: OpenAPI
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

- [x] Cliente HTTP centralizado com token e timeout (`api.ts`) — teste: "anexa o token", "timeout aborta"
- [x] 401/403 encerra sessão local (`api.ts` + `storage.ts`) — teste: "401 encerra", "403 também"
- [x] Storage de sessão isolado (`storage.ts`) — teste: "storage: set/get/clear"
- [x] Tela autenticada mínima (`HomeScreen.tsx`) consumindo `/api/auth/me`
- [x] Teste de sessão expirada (`__tests__/session.test.ts`)
- [x] Decisão registrada na ADR-0001 ("Resultado do spike": seguir)
- [x] Status RN01–RN08 atualizado na spec 08

## 6. Nice to have

- [ ] Build Expo Android/iOS (Fase 1, pós-gate)

## 7. Fonte de verdade em caso de divergência

Spec 08 e issue #11 mandam no "o quê"; este blueprint no "como". Divergência
encontrada: a issue pede "build Android/iOS" no spike, mas a ADR-0001 veda
instalar Expo antes do gate — registrado como 🟡 em CA01 com o motivo, não
resolvido em silêncio.

## 8. Divergências / achados durante a implementação

- CORS aberto no `server.js:317` aceitará o cliente nativo sem restrição;
  sinalizado na ADR como risco para a Fase 4 (rollout).
