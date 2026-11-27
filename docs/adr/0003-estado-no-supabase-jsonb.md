# ADR-0003 — Estado da API numa linha jsonb do Supabase (versão interina)

- **Status:** aceita em 2026-11-26
- **Data:** 2026-11-26
- **Escopo:** onde a API (`apps/api/server.js`) guarda os dados
- **Relacionada:** ADR-0002 (estrutura `apps/`), spec 06 (schema PostgreSQL alvo)

## Contexto

Todo o estado da API é um documento JSON (`users`, `products`, `orders`,
`financeEntries`, `sellerAccounts`, `oauthStates`, `settings`) lido e gravado
inteiro por `readDb`/`writeDb` (`apps/api/server.js:291`,
`apps/api/server.js:318`), hoje no arquivo `apps/api/data/db.json`. Num
container de deploy, esse arquivo some a cada novo deploy, a menos que haja
volume (**não verificado** se o serviço em produção tem volume com dados reais).

As tabelas normalizadas da spec 06 são o alvo, mas exigem reescrever as rotas.
Precisamos de um armazenamento durável já, sem mudar rota nem regra de negócio.

## Decisão

1. O documento inteiro passa a morar numa linha jsonb: `public.agrotech_state`,
   `id = 'main'`, coluna `data` (provisionada com `{}`, RLS ligado e sem
   políticas; só a chave service_role acessa).
2. Liga com `SUPABASE_URL` (https) **e** `SUPABASE_SERVICE_KEY`. Só uma das
   duas derruba a subida. `DATA_FILE` definido vence sempre (modo arquivo), e o
   helper dos testes tira as `SUPABASE_*` herdadas do shell.
3. Acesso pela API REST (PostgREST) com `fetch` nativo, no servidor apenas
   (`apps/api/supabase-state.js`), sem dependência nova: leitura `GET` da
   linha; gravação `PATCH ?id=eq.main` com `updated_at` no corpo, exigindo
   exatamente 1 linha afetada. Timeout de 10 s em toda chamada.
4. `readDb` troca só a origem do documento cru; o mapeamento (seed, campos
   ausentes) e `normalizeDbUsers` ficam iguais. A linha `{}` vira o seed na
   primeira leitura e é persistida na primeira gravação. Os dados começam do
   seed: nenhum `db.json` foi importado.
5. Linha ausente, falha de rede, timeout ou status não-2xx viram erro 500 com a
   mensagem genérica de hoje; a mensagem interna leva só a operação, o status e
   o `code` do PostgREST, nunca URL com query, cabeçalho, corpo ou chave.

## Consequências

- **Uma réplica obrigatória.** A fila de escrita (`apps/api/write-queue.js`) é
  por processo. Com dois processos, duas gravações concorrentes perdem uma
  (a última vence).
- **Risco interino aceito: janela de deploy com dois processos.** Se o deploy
  sobe o container novo antes de derrubar o antigo, por alguns segundos há duas
  filas separadas, e uma gravação pode se perder; a varredura de pagamentos
  também roda nos dois. Aceito como risco da versão interina, sem trava
  otimista.
- **Documento inteiro por requisição.** Toda leitura e gravação trafega o
  documento todo (fotos em data URL incluídas), com latência de rede em vez de
  disco. Limite de tamanho do corpo e latência com o documento real **não
  verificados**.
- Gravação é tudo ou nada (um `UPDATE`); se falhar, a linha fica como estava.
  Exceção: se o timeout de 10 s estourar depois de o Postgres já ter gravado, a
  rota responde 500 para uma gravação que aconteceu. Repetir a ação pode duplicar
  um pedido. Aceito na versão interina; não há idempotência no PATCH.
- O `db.json` continua sendo o banco de dev e dos testes.
- **Caminho futuro:** migrar para as tabelas da spec 06, rota a rota, quando o
  tamanho do documento ou a necessidade de mais de uma réplica pedirem.

## Opções excluídas

- Pacote `pg` ou `@supabase/supabase-js` (dependência nova para o que o `fetch` faz).
- Tabelas normalizadas da spec 06 agora (fora da versão interina; reescreve rotas).
- Upsert (`POST` com merge): recriaria em silêncio uma linha apagada com o estado em memória.
- Tratar linha ausente como `{}` (esconderia configuração errada).
- Cache do documento em memória (YAGNI; muda a semântica com mais de um processo).
- Terceira variável para escolher o backend (`DB_BACKEND`).
- Fallback automático para o arquivo quando o Supabase falha (gravaria em dois lugares).
- Trava otimista no `PATCH` por `updated_at` (cobriria a janela de deploy, mas muda o erro visto pelo usuário).
- Configurar o deploy para não sobrepor containers (**não verificado** se a plataforma permite).
- Importar o `db.json` atual de produção antes de ligar (decidido começar do seed).
