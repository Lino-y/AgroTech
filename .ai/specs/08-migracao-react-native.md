# 08 — Spec de migração mobile para React Native + Expo

- **Status:** proposta / não implementada
- **ADR:** `docs/adr/0001-migracao-para-react-native.md`
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
  `src/services/commerce.js`;
- API Express: `server.js`;
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

## Fases

### Fase 0 — spike arquitetural

- criar uma tela mínima autenticada em Expo;
- consumir `/api/auth/me` usando um cliente HTTP centralizado;
- validar armazenamento e remoção da sessão;
- validar TypeScript estrito, testes e build Android/iOS;
- registrar custo, riscos e decisão final na ADR.

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
| RN01 | Expo + TypeScript estrito validados no spike | ADR + build Android/iOS | 🔴 |
| RN02 | API e tipos mobile seguem o contrato existente | testes de integração | 🔴 |
| RN03 | API service centraliza token, timeout e 401/403 | teste do serviço | 🔴 |
| RN04 | Storage isola sessão, cache e fila | testes de storage | 🔴 |
| RN05 | Carrinho offline revalida preço e estoque | teste de reconexão | 🔴 |
| RN06 | Nenhum cartão ou pedido financeiro entra na fila | teste de segurança | 🔴 |
| RN07 | Cada fluxo migrado tem teste e rollout reversível | checklist de release | 🔴 |
| RN08 | SPA continua funcional durante o piloto | smoke test web | 🔴 |

## Fora de escopo

- migrar a API para NestJS;
- trocar JSON por PostgreSQL ou Prisma;
- adicionar Supabase, Redis, RabbitMQ ou serviços de telemetria;
- reescrever a SPA antes de validar o cliente mobile;
- implementar pagamento offline;
- instalar React Native/Expo nesta etapa documental.
