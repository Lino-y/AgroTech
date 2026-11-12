# 09 — Destaques do catálogo: perto de você, seu interesse e patrocinados

## 1. Identificação

- Nome da funcionalidade: Destaques do catálogo (Perto de você, Do seu interesse, Mais vendido, Patrocinado)
- Módulo: Catálogo (app Android `apps/mobile`, API `apps/api`, regra compartilhada `packages/domain`)
- Data: 2026-11-12
- Responsável: a definir na issue
- Status: [x] nova [ ] atualização — **proposta, aguardando aprovação**. Nenhum requisito implementado.
- Origem: pedido do usuário em 2026-11-12 ("destacar pela localização, pelo que o usuário mais
  pesquisa, e patrocinados para quem vende mais e paga, administrados por um master do app").

## 2. Objetivo

Hoje o catálogo mostra os produtos na ordem em que foram gravados: `GET /api/products` só fatia a
lista, sem ordenar (`apps/api/server.js:641`). O comprador rural não vê primeiro o que está perto dele
nem o que costuma comprar, e o vendedor não tem como pagar por visibilidade.

A funcionalidade tem quatro mecanismos **independentes**, cada um com regra e selo próprios:

| Mecanismo | Quem decide | Dado usado | Sai do aparelho? |
|---|---|---|---|
| **Patrocinado** | ADMIN (campanha paga) | campanha cadastrada no servidor | é dado do servidor |
| **Mais vendido** | regra automática | unidades vendidas nos pedidos | é dado do servidor |
| **Perto de você** | regra automática | GPS do comprador × cidade do anúncio | **não**: a posição fica no celular |
| **Do seu interesse** | regra automática | produtos abertos, buscas e carrinho do próprio usuário | **não**: o histórico fica no celular |

## 3. Decisões tomadas (2026-11-12, com o usuário)

1. **Localização do comprador vem do GPS do celular.** A alternativa recomendada (estado escolhido
   no app) foi descartada pelo usuário em favor da precisão em km. As consequências estão em RF-03 e
   na seção 12.
2. **O histórico de interesse fica só no aparelho.** A busca já roda no celular
   (`filterProducts`, `apps/mobile/src/lib/catalog.ts:12`); o servidor nunca vê o termo buscado, e
   continua sem ver.
3. **Qualquer vendedor que pague pode ser patrocinado.** Entre os patrocinados, quem vende mais
   aparece primeiro. "Mais vendido" é um selo **separado e gratuito**, por venda real.
4. **O master é o perfil `ADMIN` que já existe** (`requireAdmin`, `apps/api/server.js:335`), sem
   perfil novo. O pagamento acontece fora do app (PIX/boleto); depois de receber, o ADMIN cadastra a
   campanha. Pagamento dentro do app fica para outra fase.

## 4. Escopo

### Inclui

- Cadastro, consulta e encerramento de campanhas de patrocínio pelo ADMIN (API + tela no app).
- Selo "Patrocinado" e posição de topo, no app **e na web**: quem pagou espera aparecer nos dois.
- Selo "Mais vendido", no app e na web.
- "Perto de você" e "Do seu interesse" no app Android.
- Coordenada da cidade do anúncio, calculada no servidor a partir do texto "Cidade - UF".

### Não inclui

- Pagamento dentro do app, nota fiscal ou cobrança automática.
- Envio da posição do comprador ou do histórico de interesse ao servidor.
- "Perto de você" e "Do seu interesse" na web (a regra compartilhada permite adotar depois:
  `navigator.geolocation` já existe no navegador).
- Endereço exato do vendedor: a distância é até o centro da cidade do anúncio.
- Relatório de cliques ou impressões para o vendedor patrocinado. Isso exigiria rastrear o
  comprador no servidor, o que a decisão 2 exclui.
- Rotação de patrocinados quando houver mais campanhas que vagas no topo (ver seção 12).

## 5. Usuários e perfis impactados

- **Comprador (PRODUTOR/AMBOS) e visitante:** veem os selos e a nova ordem; podem negar a
  localização e desligar a personalização.
- **Vendedor (VENDEDOR/AMBOS):** contrata o patrocínio fora do app; o anúncio ganha topo e selo.
- **ADMIN (master):** cadastra, acompanha e encerra campanhas.

## 6. Requisitos funcionais

Status de todos: **pendente**. Itens novos estão marcados `[NOVO]`; o resto cita código já lido.

### RF-01 — Campanha de patrocínio (ADMIN) `[NOVO]`

- **Descrição:** o ADMIN cria uma campanha para um anúncio, com início, fim, valor pago e uma nota
  de pagamento (ex.: "PIX 12/11"), consulta as campanhas e encerra uma antes do fim.
  - A campanha fica em `sponsorships[]` no `db.json`, lido e gravado só por `readDb`/`writeDb`.
  - Encerrar não apaga: a campanha guarda `status: 'ENCERRADA'` e `endedAt`, para o histórico.
- **Regras:**
  - Só o ADMIN acessa (`authenticate` + `requireAdmin`); outro perfil recebe 403.
  - O anúncio tem que existir; senão, 404.
  - `endsAt` vem depois de `startsAt`, e a duração vai de 1 a 90 dias; senão, 400.
  - Um anúncio não pode ter duas campanhas que se sobrepõem no tempo; a segunda recebe 409.
  - O valor é inteiro em centavos, de 0 a 1.000.000.000 (R$ 10 milhões). É o mesmo teto de dinheiro
    do servidor (`MAX_PRICE`, `apps/api/server.js:664`), que evita total infinito.
  - A nota passa por `cleanText`.
- **Critério de aceite:** as quatro regras de validação acima têm teste de API em
  `tests/*.test.js`, que sobe o servidor com banco descartável (`DATA_FILE`).

### RF-02 — Patrocinado no catálogo `[NOVO]`

- **Descrição:** `GET /api/products` passa a devolver, por produto:
  - `sponsoredUntil`: o fim da campanha ativa (ISO), ou `null`;
  - `sponsoredRank`: a posição entre os patrocinados, ou `null`.
- **Campanha ativa:** `status = 'ATIVA'`, `startsAt ≤ agora < endsAt`, o anúncio existe e tem
  estoque. Estoque ausente conta como disponível: os produtos de demonstração não têm `stock`
  (comentário em `apps/api/server.js:862`).
- **`sponsoredRank`:** unidades vendidas nos últimos 90 dias, da maior para a menor (RF-04). Empate:
  a campanha que começou antes fica na frente.
- **O que nunca aparece fora do ADMIN:** o valor pago e a nota de pagamento.
- **Exibição:**
  - no máximo **2** patrocinados no topo da lista, sempre com o selo **"Patrocinado"** visível e
    distinto dos outros selos;
  - patrocinados além das 2 vagas aparecem na posição normal, ainda com o selo;
  - a busca e a categoria filtram **antes**: um patrocinado que não corresponde ao filtro não
    aparece;
  - o selo some quando `sponsoredUntil` passa, pelo relógio do aparelho, inclusive no catálogo salvo
    offline.
- **Critério de aceite:**
  - teste de domínio do topo com 0, 1, 2 e 3 patrocinados;
  - teste do patrocinado fora do filtro;
  - teste de limite: campanha com `endsAt` exatamente igual a agora já não conta.

### RF-03 — Perto de você (app Android) `[NOVO]`

- **Coordenada do anúncio:**
  - Hoje `location` é texto livre "Cidade - UF", com padrão `'Região Agrícola - BR'`
    (`apps/api/server.js:715`); `extractLocation` já normaliza esse formato
    (`packages/domain/listing.js:270`).
  - O servidor converte "Cidade - UF" na coordenada do centro do município, por uma tabela pública
    de municípios do IBGE guardada no servidor `[NOVO]`. Ele devolve `coords: { lat, lon }`, com 2
    casas decimais, ou `null`.
  - Texto que não casa com nenhum município fica `null` e nunca recebe "Perto de você".
- **Posição do comprador:**
  - Lida pelo `expo-location` `[NOVO]`, em primeiro plano, com permissão só aproximada
    (`ACCESS_COARSE_LOCATION`). `ACCESS_FINE_LOCATION` e localização em segundo plano entram em
    `blockedPermissions` (`apps/mobile/app.json:11`).
  - O app pede a permissão **só quando** a pessoa toca em "Mostrar o que está perto de mim", nunca
    na abertura. Um texto curto antes do pedido explica para que serve.
  - Se a pessoa negar, o catálogo segue sem proximidade e o app não pede de novo na mesma sessão.
  - A posição fica no aparelho e **nunca** vai em requisição. A última posição fica salva no
    aparelho, com a hora, para funcionar offline.
- **Distância:** linha reta (haversine) entre o comprador e o centro da cidade do anúncio, calculada
  no aparelho. O selo mostra "Perto de você · N km" quando a distância for **≤ 150 km**.
- **Critério de aceite:**
  - teste de domínio da distância com par de cidades conhecido;
  - teste do limite de exatamente 150 km;
  - teste de API: "Cidade - UF" válido vira `coords` e o padrão `'Região Agrícola - BR'` vira
    `null`;
  - o APK novo só pede INTERNET e a localização aproximada, conferido com `aapt2 dump badging`.

### RF-04 — Mais vendido `[NOVO]`

- **Descrição:** o servidor conta as unidades vendidas por produto nos pedidos dos últimos 90 dias
  (`items[].id` e `quantity`, `apps/api/server.js:873`). O selo **"Mais vendido"** vai para os 3
  produtos com mais unidades, só se tiverem pelo menos 5 unidades.
- **O número exato de vendas não é público,** porque revela o volume de negócio do vendedor. Só
  saem o selo (`bestSeller: true`) e o `sponsoredRank`.
- **Critério de aceite:**
  - teste com pedido de 91 dias atrás, que não conta;
  - teste com exatamente 5 unidades, que conta;
  - teste de empate.

### RF-05 — Do seu interesse (app Android) `[NOVO]`

- **Sinais, guardados no aparelho:**
  - abrir o detalhe de um produto dá +1 para a categoria dele;
  - adicionar ao carrinho dá +2;
  - uma busca cujos resultados ficam todos numa única categoria dá +1 para essa categoria.
- **Guarda:** `AsyncStorage`, na chave `interest:{id do usuário ou 'visitante'}`, no mesmo esquema
  de cache com dono (`apps/mobile/src/services/storage.ts`). Sinais com mais de 90 dias são
  ignorados.
- **Uso:** as 3 categorias com mais pontos sobem na ordem (RF-06). Não há selo próprio, para não
  poluir o card.
- **Controle da pessoa:** em Conta, "Personalizar o catálogo" (ligado por padrão) e "Limpar meu
  histórico". Sair da conta e excluir a conta apagam o histórico daquele usuário no aparelho.
- **Critério de aceite:**
  - teste do sinal antigo (91 dias) ignorado;
  - teste de "Limpar" zerando a ordem;
  - teste de que nenhuma requisição leva termo de busca ou histórico.

### RF-06 — Ordem final do catálogo `[NOVO]`

Uma única função pura em `packages/domain` (`[NOVO]` arquivo `ranking.js`) ordena o catálogo para o
app e para a web. O arquivo entra na lista exata de `tests/domain-boundary.test.js:8`.

1. Aplica a busca e a categoria (regra atual). A ordem **nunca acrescenta** produto.
2. Topo: até 2 patrocinados ativos, por `sponsoredRank`.
3. Restante, por pontos:
   - proximidade: ≤ 50 km dá +2; ≤ 150 km dá +1;
   - interesse: categoria mais forte dá +2; segunda e terceira dão +1;
   - "Mais vendido" dá +1.
4. Empate mantém a ordem do servidor (ordenação estável).
5. Sem GPS, sem histórico e sem patrocinado, a ordem fica idêntica à de hoje.

**Selos por card:** "Patrocinado" sempre aparece quando ativo. Dos outros dois, aparece só um, com
prioridade para "Mais vendido" sobre "Perto de você".

- **Critério de aceite:** teste de domínio para cada passo e teste de que a lista sem sinais sai na
  mesma ordem de entrada.

### RF-07 — Tela de patrocínios (ADMIN, app) `[NOVO]`

- **Descrição:** em Conta, ao lado da tela de usuários do ADMIN que já existe
  (`AdminUsersScreen`), entra a tela "Patrocínios". Ela:
  - lista as campanhas ativas, futuras e encerradas;
  - cria uma campanha escolhendo o anúncio, início, fim, valor e nota;
  - encerra uma campanha.
- **Online apenas:** campanha é dinheiro, e o app já segue a regra de não enfileirar ação financeira
  offline.
- **Critério de aceite:** teste de tela ou fumaça contra API descartável cobrindo criar, ver no
  catálogo e encerrar.

## 7. Requisitos não funcionais

- **Performance:** a ordenação roda no aparelho sobre o catálogo inteiro, que o app já carrega sem
  paginação (`loadProducts`, `apps/mobile/src/services/products.ts:30`). Contar vendas lê `orders`
  no servidor a cada `GET /api/products`. No volume atual (arquivo JSON) isso é aceitável; com o
  PostgreSQL da spec 06, vira consulta agregada ou cache por minuto.
- **Segurança:**
  - rotas de campanha só para ADMIN;
  - valor e nota nunca saem na rota pública;
  - todas as datas e números validados no servidor, nunca só no app.
- **Offline:**
  - o catálogo salvo guarda `sponsoredUntil`, `bestSeller` e `coords`;
  - patrocínio vencido perde o selo pelo relógio do aparelho;
  - posição e histórico funcionam sem rede;
  - a tela do ADMIN exige rede.
- **LGPD/compliance:**
  - Posição e histórico de interesse não chegam ao servidor (finalidade e necessidade, art. 6º da
    LGPD). A permissão de localização vem com texto de finalidade, e a pessoa pode desligar a
    personalização e limpar o histórico.
  - O selo "Patrocinado" atende ao CDC (Lei 8.078/1990), art. 36: a publicidade deve ser
    identificada como tal, fácil e imediatamente. A política de privacidade do app precisa citar a
    localização antes da distribuição.
- **Observabilidade:**
  - criar e encerrar campanha grava quem fez (`createdBy`, `endedBy`) e quando;
  - nenhum log de posição ou de busca.

## 8. Fluxo principal

1. O vendedor combina e paga o patrocínio fora do app.
2. O ADMIN abre Conta → Patrocínios, escolhe o anúncio e informa período, valor e nota.
3. O servidor valida e grava a campanha.
4. O comprador abre o catálogo:
   - o app busca `GET /api/products`, que agora traz `sponsoredUntil`, `sponsoredRank`,
     `bestSeller` e `coords`;
   - o app aplica a ordem de RF-06 com a posição e o histórico locais.
5. O comprador toca em "Mostrar o que está perto de mim", aceita a permissão e vê os selos "Perto de
   você · N km".
6. No fim do período a campanha deixa de valer sozinha, ou o ADMIN a encerra antes.

## 9. Fluxos alternativos e erros

- **Permissão de localização negada:**
  - sem proximidade, sem novo pedido na sessão;
  - o botão vira "Ativar localização nas configurações".
- **GPS desligado, ou sem sinal no campo:** o app usa a última posição salva e mostra a hora; sem
  posição salva, o catálogo segue sem proximidade.
- **Anúncio patrocinado excluído pelo dono, ou conta excluída:**
  - a campanha encerra junto (`endedBy: 'sistema'`), no mesmo ponto em que a exclusão de conta já
    limpa os anúncios (`apps/api/server.js:564`);
  - o ADMIN vê o motivo no histórico.
- **Estoque zerado:** o anúncio sai do topo enquanto não houver estoque; a campanha não se estende
  sozinha.
- **Campanha sobreposta:** 409, com a mensagem "Este anúncio já tem campanha nesse período."

## 10. Integrações

- **Sistema externo:** nenhum em tempo de execução.
  - A tabela de municípios do IBGE (nome, UF, latitude, longitude) é um arquivo estático no
    servidor. A fonte e a licença serão conferidas e citadas no blueprint.
  - O `expo-location` lê o GPS do aparelho; não há conversão de coordenada em endereço
    (geocodificação reversa) e não há chamada a serviço de mapas.
- **Dependência nova:** `expo-location`, só com aprovação explícita e conferência por
  `npm view expo-location` (versão compatível com o Expo SDK do app), como pede
  `docs/agents/architecture.md`.

## 11. Contratos

### Formato novo no `db.json` `[NOVO]`

```text
sponsorships[]: {
  id, productId, sellerEmail,
  startsAt, endsAt,                 // ISO
  amountCents, paymentNote,         // só ADMIN vê
  status: 'ATIVA' | 'ENCERRADA',
  createdBy, createdAt, endedBy?, endedAt?
}
```

### API

As mudanças entram em `.ai/specs/05-openapi-spec.md` no PR de implementação, antes do código:

- `GET /api/products`: cada item ganha `sponsoredUntil`, `sponsoredRank`, `bestSeller` e `coords`.
- `GET /api/admin/sponsorships`: lista campanhas (ADMIN).
- `POST /api/admin/sponsorships`: cria campanha. Erros: 400 (validação), 404 (anúncio), 409
  (sobreposição).
- `POST /api/admin/sponsorships/:id/end`: encerra campanha (ADMIN).

## 12. Riscos

| Risco | Mitigação |
|---|---|
| A localização de anúncios antigos é texto livre ou o padrão `'Região Agrícola - BR'`; muitos ficam sem `coords` | O formulário de anúncio passa a sugerir "Cidade - UF" válido (`extractLocation` já reconhece). Anúncio sem coordenada só perde o selo, não some |
| GPS exige permissão nova e dependência nova, e o comprador pode recusar | Pedido só sob ação da pessoa, com permissão só aproximada; o catálogo funciona igual sem ela |
| Mais campanhas que as 2 vagas: quem vende menos nunca chega ao topo | O ADMIN controla quantas vende. Rotação fica para quando houver demanda (fora do escopo) |
| Patrocinado empurra produto irrelevante | O filtro de busca e de categoria vem antes; o topo tem só 2 vagas; o selo é obrigatório |
| O relógio errado do aparelho mantém ou tira o selo offline | Online, o servidor decide; offline vale o aparelho, e o erro máximo é a duração do cache |
| `ownerEmail` público no catálogo (decisão ainda aberta) | A campanha usa `sellerEmail` só na rota do ADMIN |

## 13. Validação

- **Como será validado:**
  - testes de domínio (`ranking.js`) e de API com banco descartável;
  - fumaça contra API local;
  - APK conferido (permissões, módulo de localização no dex).
- **Teste em aparelho real:** pendente, como nas fases anteriores.
- **Evidência esperada:** cada RF só vira ✅ com `arquivo:linha` e teste, no blueprint
  `docs/tasks/{issue}-destaques-patrocinados/blueprint.md`.

## 14. Questões em aberto (decisão de negócio, não bloqueiam o desenho)

- Preço e período padrão do patrocínio. A spec só registra o valor que o ADMIN informar.
- Valores padrão propostos, ajustáveis: raio de 150 km, 2 vagas no topo, "Mais vendido" com top 3 e
  pelo menos 5 unidades em 90 dias.
- Tela de patrocínios na web para o ADMIN: hoje só no app; a web pode vir depois.
