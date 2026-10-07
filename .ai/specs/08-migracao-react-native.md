# 08 — Spec de migração futura para React Native

- **Status:** proposta / não implementada
- **Tipo:** evolução arquitetural do cliente mobile
- **ADR:** `docs/adr/0001-migracao-para-react-native.md`

## Objetivo

Avaliar e, se aprovado, migrar progressivamente o cliente mobile do AgroTech
da SPA web atual para React Native, preservando os contratos da API e as regras
de negócio comprovadas por testes.

Esta spec documenta o alvo e o caminho de decisão. Ela não autoriza instalar
React Native, Expo, bibliotecas de navegação ou qualquer nova dependência.

## Estado atual

- cliente: HTML, CSS e módulos ES sem build;
- estado e telas: `src/modules/catalog.js`;
- serviços de API: `src/services/api.js`;
- regras puras reutilizáveis: `src/services/`;
- API: Express em `server.js`;
- persistência: arquivo JSON local, sem banco remoto;
- autenticação: sessão JWT consumida pelo cliente;
- cobertura atual: testes nativos em `tests/`.

## Escopo da avaliação

O spike deve responder:

- React Native atende os fluxos mobile prioritários?
- Expo ou React Native CLI é compatível com distribuição e integrações
  necessárias?
- quais funções de `src/services/` podem ser extraídas sem dependência de DOM?
- como serão tratados token, logout, expiração e armazenamento seguro?
- quais dados precisam funcionar offline e como serão sincronizados?
- a API atual precisa de novos endpoints ou apenas de ajustes de contrato?
- web e mobile compartilharão código por pacote ou apenas contratos/testes?

## Fases propostas

### Fase 0 — decisão e spike

- fechar fluxos prioritários;
- comparar Expo e React Native CLI;
- validar uma tela autenticada contra `/api/auth/me`;
- medir esforço, tamanho do bundle, tempo de inicialização e limitações
  nativas;
- registrar a decisão em uma ADR aprovada.

### Fase 1 — contratos e domínio

- estabilizar `.ai/specs/05-openapi-spec.md`;
- identificar regras de negócio sem DOM em `src/services/`;
- garantir testes para cada regra migrada;
- definir modelos de sessão, produto, carrinho e pedido;
- definir compatibilidade entre versões web, API e mobile.

### Fase 2 — fundação mobile

- criar o shell mobile somente após a aprovação da Fase 0;
- configurar navegação, tema, tratamento de erro e telemetria;
- implementar login, logout e restauração segura de sessão;
- validar acessibilidade, estados de carregamento e falha de rede.

### Fase 3 — fluxos verticais

Migrar em fatias completas, nesta ordem inicial:

1. autenticação;
2. catálogo, busca e filtros;
3. carrinho e cupons;
4. checkout e pedidos;
5. rastreio e suporte;
6. finanças, se confirmadas como prioridade mobile.

Cada fatia precisa incluir tela, serviço, tratamento de erro, testes e
critério de rollout. Nenhuma tela deve ser considerada migrada apenas por ter
um protótipo visual.

### Fase 4 — offline e rollout

- implementar somente o offline aprovado na decisão de produto;
- testar expiração de sessão, duplicidade de pedido e reconciliação;
- publicar para grupo piloto;
- comparar erros, conversão e desempenho com a SPA;
- definir a retirada ou manutenção do cliente web.

## Contratos obrigatórios antes do código

- endpoint novo ou alterado: atualizar `.ai/specs/05-openapi-spec.md`;
- regra de negócio: teste em `tests/` antes ou junto da implementação;
- novo armazenamento mobile: documentar dados, criptografia, expiração e
  limpeza no logout;
- fluxo offline: documentar estados pendente, sincronizado e conflitante;
- cada critério concluído: evidência de código e teste;
- dependência nova: justificar escolha, versão e alternativa descartada.

## Critérios de aceite da migração

| ID | Critério | Verificação | Status |
|---|---|---|---|
| RN01 | Spike compara Expo e React Native CLI | ADR aprovada com métricas | 🔴 |
| RN02 | Fluxos prioritários estão definidos | Spec de produto aprovada | 🔴 |
| RN03 | Contratos da API têm política de compatibilidade | OpenAPI + teste de integração | 🔴 |
| RN04 | Sessão é restaurada e removida com segurança | Testes de login/logout/expiração | 🔴 |
| RN05 | Cada fluxo migrado tem teste funcional | Testes mobile e de API | 🔴 |
| RN06 | Offline e sincronização têm comportamento definido | Testes de falha e reconciliação | 🔴 |
| RN07 | Rollout piloto não aumenta erros críticos | Métricas e checklist de release | 🔴 |

## Fora de escopo nesta etapa

- instalar React Native ou Expo;
- reescrever `src/modules/catalog.js`;
- alterar a API sem contrato aprovado;
- trocar o arquivo JSON por PostgreSQL;
- adicionar notificações, pagamentos reais ou sincronização offline sem uma
  decisão específica.
