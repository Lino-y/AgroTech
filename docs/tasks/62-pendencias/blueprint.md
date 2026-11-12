# Blueprint: pendências do app e da API (#62)

Spec: issue #62, `.ai/specs/08-migracao-react-native.md` (Fases 2 e 3, RN06, RN09, RN11) e
`.ai/specs/05-openapi-spec.md` (contratos novos). Pedido do dono: "implementar tudo que ficou para
depois". PR empilhado sobre o do offline (`docs/tasks/62-app-offline/blueprint.md`).

## 1. Dor do usuário

O app ficou sem favoritos, avaliações, suporte, rastreio, "IA" do anúncio, foto, fila offline de
anúncios, recuperação de senha, tema escuro e a fonte da web; e a API tinha achados abertos (estoque
não conferido, senha de 1 caractere, versão mínima só informativa).

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Regras de suporte e da "IA" do anúncio num lugar só (`packages/domain`), usadas pela web e pelo app | teste | ✅ | `packages/domain/support.js:8`, `packages/domain/listing.js:351`, `src/modules/catalog.js:286`; caracterização `tests/listing.test.js:76` |
| CA02 | Pedido confere o estoque (produto com estoque numérico) e baixa ao gravar; o reenvio com a mesma chave não baixa de novo | teste de API | ✅ | `apps/api/server.js:868`, `apps/api/server.js:911`; `tests/pending-api.test.js:69`, `tests/pending-api.test.js:80` |
| CA03 | `Idempotency-Key` em `POST /api/products`, por dono; a chave não sai no catálogo público | teste de API | ✅ | `apps/api/server.js:737`, `apps/api/server.js:636`; `tests/pending-api.test.js:102`, `tests/pending-api.test.js:135` |
| CA04 | Senha com no mínimo 8 caracteres no cadastro e na redefinição (API, web e app); login antigo intacto | teste | ✅ | `packages/domain/commerce.js:102`; `tests/pending-api.test.js:45` |
| CA05 | App abaixo de `APP_MIN_VERSION` recebe 426 e mostra "Atualize o app"; a SPA nunca é barrada | teste | ✅ | `apps/api/server.js:363`, `apps/api/app-version.js:28`, `apps/mobile/src/services/api.ts:47`, `apps/mobile/src/services/api.ts:64`, `apps/mobile/src/screens/UpdateScreen.tsx:18`; `tests/pending-api.test.js:145`, `apps/mobile/__tests__/pending.test.ts:68` |
| CA06 | Redefinição de senha por código do ADMIN: aleatório, guardado só como hash, 30 minutos, uso único, mesma resposta para e-mail ou código errado, limite de tentativas, sessões derrubadas | teste de API + fumaça | ✅ | `apps/api/server.js:497`, `apps/api/server.js:961`; `tests/pending-api.test.js:173`, `tests/pending-api.test.js:190`, `tests/pending-api.test.js:214`; app `apps/mobile/src/screens/ResetForm.tsx:28`, `apps/mobile/src/screens/AdminUsersScreen.tsx:38` |
| CA07 | Fila offline só de anúncios: chave criada uma vez e repetida, por conta, sem rede continua pendente, recusa vira falha visível; pedido, pagamento e financeiro nunca entram (RN06) | teste + fumaça | ✅ | `apps/mobile/src/lib/outbox.ts:20`, `apps/mobile/src/services/outbox.ts:35`, `apps/mobile/src/screens/SellScreen.tsx:145`; `apps/mobile/__tests__/pending.test.ts:158`, `apps/mobile/__tests__/pending.test.ts:164`, `apps/mobile/__tests__/pending.test.ts:182` |
| CA08 | Favoritos por conta no aparelho; avaliações no detalhe (ler e publicar) | teste | ✅ | `apps/mobile/src/services/favorites.ts:14`, `apps/mobile/src/screens/ProductDetailScreen.tsx:44`; `apps/mobile/__tests__/pending.test.ts:126` |
| CA09 | Rastreio (linha do tempo da entrega) em Meus pedidos; suporte com o robô do domínio | leitura do código | 🟡 | `apps/mobile/src/screens/OrdersScreen.tsx:93`, `apps/mobile/src/screens/SupportScreen.tsx:27`; não visto em aparelho |
| CA10 | "IA" do anúncio no app e foto só da galeria (reduzida, limite de 1,4 MB), sem câmera nem microfone no APK | teste + `aapt2` | ✅ | `apps/mobile/src/screens/SellScreen.tsx:79`, `apps/mobile/src/screens/SellScreen.tsx:89`, `apps/mobile/src/lib/sell.ts:67`, `apps/mobile/app.json:18`, `apps/mobile/app.json:36`; `apps/mobile/__tests__/sell.test.ts:40`; seção 8.1 |
| CA11 | Tema escuro com os mesmos contrastes mínimos (testados nos dois temas) e títulos na fonte da web (Outfit) | teste | ✅ | `apps/mobile/src/theme.ts:33`, `apps/mobile/src/theme.ts:57`, `apps/mobile/index.ts:5`, `apps/mobile/src/App.tsx:42`; `apps/mobile/__tests__/theme.test.ts:37` |
| CA12 | Tudo conferido em aparelho | aparelho | 🔴 | não feito: sem aparelho neste PC |

## 3. Contratos (antes do código)

Spec 05 atualizada antes do código: 426 e `X-App-Version` (`/api/app-config`), senha mínima
(`/api/auth/register`), `Idempotency-Key` e 200/409 em `POST /api/products`, 409 por estoque em
`POST /api/orders`, e as rotas novas `POST /api/admin/users/{id}/reset-code` e
`POST /api/auth/reset-password`. No `db.json`, o usuário ganha `resetCodeHash` e
`resetCodeExpiresAt` (somem ao usar o código) e o anúncio pode ter `idempotencyKey` e `requestHash`
(nunca públicos).

## 4. Decisões técnicas

- **Financeiro continua só online:** a spec 08 (Fase 3) só permite fila para ação não financeira e
  idempotente, e a RN06 proíbe item financeiro na fila. Lançamento manual é financeiro.
- **Recuperação de senha pelo ADMIN, não por e-mail:** não há serviço de e-mail; escolher o provedor e
  as credenciais é decisão do dono. O código é repassado por fora (telefone, WhatsApp).
- **"IA" do anúncio é local** (palavras-chave), como na web: nenhuma chave de API. A função foi movida
  sem mudar a lógica, com testes de caracterização gravados antes de dividi-la (lint 18 → 17 avisos).
- **Tema escolhido ao abrir o app** (ponytail em `theme.ts`): os estilos são criados quando a tela
  carrega; mudar o tema do aparelho com o app aberto vale na próxima abertura.
- **Fila sem foto:** o armazenamento local do Android é pequeno (uns 6 MB); o anúncio guardado vai só
  com o texto, e a tela avisa.
- **Dependências novas** (versões da SDK 58, `npm view` conferido): `expo-image-picker`,
  `expo-image-manipulator`, `@expo-google-fonts/outfit`.

## 5. Must have

- CA01 a CA11.

## 6. Nice to have

- Sincronizar favoritos com o servidor (a web também guarda só no navegador).

## 7. Fonte de verdade em caso de divergência

Spec 08 e spec 05 mandam no "o quê"; este blueprint, no "como".

## 8. Divergências / achados durante a implementação

- **Fora do alcance daqui:** iOS (sem Mac e sem conta Apple), teste em aparelho, chave de assinatura de
  produção e serviço de e-mail. Decisões abertas do dono: `ownerEmail` público no catálogo e aceitar a
  ADR-0001.
- **Excluir avaliação no app não entrou:** a API só deixa o autor ou o ADMIN excluir, e o catálogo
  público não diz quem é o autor (a web também não mostra).
- **Teste de tela instável:** "pagamento manda só items e coupon" falhou 1 vez em 4 execuções de
  `npm run test:ui` nesta etapa, sem relação com as mudanças (passou nas outras 3).
- **Fumaça contra API real** (porta separada, banco descartável): anúncio publicado sem rede foi para a
  fila, continuou pendente com a API fora, saiu uma vez só quando ela voltou, e o reenvio com a mesma
  chave não duplicou; app 0.3.0 com mínimo 0.4.0 recebeu 426; o ADMIN gerou o código e a senha foi
  trocada pelo app.

### 8.1 Evidência do APK 0.4.0

Arquivo: `C:/Users/Rooselt/AgroTech-APK/agrotech-0.4.0.apk` (substitui o 0.3.0), 68.129.138 bytes, SHA-256
`9704e28b558a04ee42df3ab8a0dcf8a15bc947d7f7411b12512c7d1bb3079a62`.

- `aapt2 dump badging`: `versionCode` 10, `versionName` 0.4.0, permissão `INTERNET` apenas: o seletor de fotos
  não trouxe câmera, microfone nem armazenamento (bloqueados no `app.json`; a galeria usa o seletor de fotos
  do Android, que não pede permissão). `apksigner verify`: válido.
- Módulos nativos no `classes.dex`: seletor de imagem, redimensionador, AsyncStorage e fontes. Fontes no APK:
  só Ionicons e Outfit Bold (o primeiro build levou os 9 pesos da Outfit; corrigido importando só o Bold e
  limpando os recursos gerados).
- Bundle extraído do APK com a fila de anúncios, a foto, o "esqueci a senha", o 426 e o endereço
  `192.168.1.34:3001`.
- Build: `expo prebuild --clean` (plugins novos) e `BUILD SUCCESSFUL` em 10 min 47 s; depois 1 min 46 s
  com a fonte corrigida. Testes: app 118 de 118; raiz com `tests/pending-api.test.js` (17) e
  `tests/listing.test.js` (6).
- API do celular (porta 3001) reiniciada com o código novo: quem estava logado precisa entrar de novo.
- No Android 12 ou mais antigo, escolher foto depende do seletor de fotos dos serviços do Google Play
  (o armazenamento antigo está bloqueado). Não visto em aparelho (CA12).

