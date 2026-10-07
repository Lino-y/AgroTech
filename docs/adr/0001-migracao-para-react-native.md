# ADR-0001 — Migração futura para React Native

- **Status:** proposta
- **Data:** 2026-10-07
- **Escopo:** cliente mobile do AgroTech

## Contexto

O cliente atual é uma SPA web em JavaScript puro, servida pelo Express. A
interface é renderizada com HTML/CSS e `innerHTML`, o estado principal fica em
`src/modules/catalog.js` e o acesso à API é concentrado em
`src/services/api.js`. A API Express e seus contratos permanecem no
`server.js`.

O produto é mobile-first, mas isso não significa que a implementação web possa
ser convertida diretamente para componentes nativos. React Native mudaria a
camada de apresentação, navegação, armazenamento local, ciclo de vida e
estratégia de testes do cliente.

## Decisão proposta

Registrar React Native como alvo possível para um futuro cliente mobile, sem
iniciar a migração nesta etapa. A decisão de implementação só será tomada após
um spike que compare React Native com a manutenção da SPA e defina se Expo ou
React Native CLI atende melhor às necessidades de distribuição e integração
nativa.

A API Express, os contratos HTTP e as regras de negócio independentes de DOM
devem ser tratados como ativos reutilizáveis. A interface web atual não deve
ser copiada literalmente para o cliente nativo.

## Alternativas consideradas

### Continuar somente com a SPA web

Menor custo imediato e máxima reutilização do código atual, mas não entrega um
cliente nativo nem resolve necessidades futuras de notificações, armazenamento
offline e integração com recursos do dispositivo.

### Reescrever diretamente em React Native

Entrega um cliente nativo mais cedo, mas concentra risco em uma grande
reescrita sem validar contratos, prioridades de tela ou requisitos offline.

### Migração incremental por fatias

Reduz risco: primeiro estabiliza contratos e regras reutilizáveis, depois migra
fluxos verticais como autenticação, catálogo, carrinho e pedidos. Exige manter
web e mobile durante parte do processo, mas permite validar cada etapa.

**Alternativa preferida:** migração incremental, condicionada ao resultado do
spike de arquitetura.

## Consequências

### Positivas

- cliente mobile com componentes e navegação nativos;
- caminho para notificações, armazenamento seguro e comportamento offline;
- separação mais clara entre API, regras de negócio e apresentação;
- possibilidade de testes de fluxo mobile independentes da SPA.

### Custos e riscos

- duas superfícies de cliente durante a transição;
- necessidade de definir autenticação e sincronização offline;
- reescrita da apresentação e dos testes de interface;
- manutenção de compatibilidade da API durante o rollout;
- custo de publicação, observabilidade e suporte em Android/iOS.

## Não decidido nesta ADR

- Expo versus React Native CLI;
- estratégia de monorepo ou repositório separado;
- biblioteca de navegação e gerenciamento de estado;
- suporte offline completo versus cache somente de leitura;
- matriz mínima de versões Android/iOS;
- publicação nas lojas.

## Gate para iniciar a implementação

A migração só pode começar quando existir uma spec aprovada com:

1. telas e fluxos prioritários;
2. contratos da API e política de compatibilidade;
3. estratégia de autenticação, armazenamento e logout;
4. decisão sobre Expo/CLI e estrutura de repositório;
5. plano de testes e distribuição;
6. critérios de sucesso do spike.

## Referências do estado atual

- `docs/agents/architecture.md` — restrições de stack e camadas atuais;
- `src/modules/catalog.js` — estado e orquestração da SPA;
- `src/services/api.js` — acesso do cliente à API;
- `server.js` — API Express e persistência atual;
- `.ai/specs/03-requisitos-nao-funcionais.md` — requisito mobile-first;
- `.ai/specs/05-openapi-spec.md` — contrato documentado da API.
