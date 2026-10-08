# ADR-0001 — Arquitetura mobile React Native + Expo

- **Status:** proposta para aprovação
- **Data:** 2026-10-07
- **Escopo:** futuro cliente mobile do AgroTech
- **Referência de padrão:** arquitetura mobile já praticada no projeto Mais Frota

## Contexto

O AgroTech é hoje uma SPA web em JavaScript puro, servida pelo Express. O
estado e a orquestração das telas estão concentrados em
`src/modules/catalog.js`; o acesso HTTP fica em `src/services/api.js`; regras
de negócio parcialmente puras ficam em `src/services/`; e a API permanece no
`server.js`.

O produto é mobile-first, mas a implementação atual depende de DOM,
`innerHTML`, `localStorage` e handlers globais. Ela não deve ser portada
literalmente para um cliente nativo.

O projeto Mais Frota já demonstra um padrão mais maduro para mobile: Expo,
TypeScript estrito, store por slices, serviços de API/storage separados, fila
offline explícita e testes de persistência e sincronização. O AgroTech deve
adotar esse padrão de separação, adaptando-o ao domínio de e-commerce.

## Decisão proposta

Criar, em fase posterior, um cliente `apps/mobile` em React Native + Expo e
TypeScript estrito, mantendo a SPA web durante a transição.

O alvo arquitetural é:

```text
apps/mobile/
├─ app/
│  ├─ screens/          # telas e fluxos de usuário
│  ├─ components/       # componentes visuais reutilizáveis
│  ├─ navigation/       # rotas e guards de sessão
│  ├─ store/             # slices e orquestração assíncrona
│  ├─ services/         # API, storage seguro e fila offline
│  ├─ domain/            # regras puras adaptadas dos services atuais
│  └─ types/             # contratos mobile
└─ __tests__/            # unidade, integração e cenários offline

server.js                # API Express durante a transição
src/                     # cliente web legado, mantido até o rollout
```

O alvo reutiliza contratos e regras, não a apresentação web. A API Express
continua sendo o backend inicial; uma futura separação em serviços só deve
nascer de uma ADR própria.

## Padrões obrigatórios do cliente mobile

- **Expo + TypeScript estrito:** mesma base Android/iOS e build simplificado;
- **camadas separadas:** tela não acessa `fetch`, storage ou detalhes de
  autenticação diretamente;
- **API service:** cliente HTTP centralizado, timeout, token, tratamento de
  401/403 e erros tipados;
- **storage service:** uma abstração única para sessão, cache e fila; segredo
  de autenticação usa armazenamento seguro quando disponível;
- **estado por domínio:** slices para sessão, catálogo, carrinho, pedidos e
  suporte; efeitos assíncronos ficam fora dos componentes;
- **fila offline explícita:** itens possuem id, data, tentativas, status e
  política de retry; ações precisam ser idempotentes no servidor;
- **testes por camada:** domínio sem React Native, serviços com mocks de rede e
  storage, e fluxos de tela com estados online/offline;
- **contratos:** API continua documentada em `.ai/specs/05-openapi-spec.md`;
  tipos mobile não podem inventar campos divergentes do contrato.

## Política offline do AgroTech

O offline deve ser adequado ao domínio, não copiado do fluxo de telemetria do
Mais Frota:

| Fluxo | Offline | Regra |
|---|---|---|
| Catálogo já consultado | leitura | cache com data e indicação de desatualização |
| Busca/filtros | parcial | somente sobre dados armazenados localmente |
| Carrinho | sim | persistir localmente e revalidar preços/estoque ao reconectar |
| Favoritos/perfil | sim, se não sensível | sincronização posterior com conflito definido |
| Criar pedido | não concluir offline | exige revalidação de preço, estoque e frete |
| Pagamento | não | nunca enfileirar dados de cartão ou confirmação de pagamento |
| Rastreio do pedido | cache | mostrar último estado e atualizar ao reconectar |
| Chat de suporte | rascunho | enviar apenas após rede disponível |

Nenhuma ação financeira pode ser reenviada sem uma chave de idempotência e
estado de sincronização definido no contrato da API.

## Alternativas

### Manter somente a SPA web

Menor custo imediato, mas não entrega um cliente nativo nem uma base adequada
para storage seguro, notificações e offline controlado.

### React Native sem Expo

Oferece controle nativo máximo, mas aumenta custo de configuração e manutenção
para o estágio atual do produto.

### React Native + Expo

É a opção recomendada: acompanha o padrão maduro já usado no Mais Frota,
reduz o custo inicial para Android/iOS e permite adotar módulos nativos quando
necessário.

## O que não será copiado do Mais Frota

- NestJS, Prisma, Supabase, Redis e RabbitMQ;
- módulos de telemetria, geofence, mapas e auditoria de combustível;
- offline-first indiscriminado para operações financeiras;
- monorepo completo antes de existir mais de um cliente ou pacote compartilhado.

Essas tecnologias só entram mediante necessidade real, contrato e ADR própria.

## Gate de aprovação

Antes de instalar Expo ou criar `apps/mobile`, devem estar aprovados:

1. fluxos mobile prioritários;
2. escolha Expo e matriz Android/iOS;
3. contrato de sessão, storage e logout;
4. política offline acima e idempotência de pedidos;
5. estratégia de navegação e estado;
6. plano de testes, distribuição e rollout;
7. orçamento de manutenção da SPA durante a transição.

## Consequências

### Positivas

- arquitetura mobile testável e separada do DOM;
- padrão conhecido pela equipe;
- offline limitado a fluxos seguros para e-commerce;
- API e regras de negócio podem evoluir sem acoplar a UI.

### Custos e riscos

- dois clientes durante a migração;
- duplicação temporária de telas e testes;
- necessidade de manter compatibilidade da API;
- complexidade de cache, revalidação de preço e sincronização;
- custo adicional de publicação e suporte Android/iOS.
