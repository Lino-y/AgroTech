# Blueprint: APK Android do app mobile (#62, Fase 1 mínima)

Spec: issue #62 e `.ai/specs/08-migracao-react-native.md` (Fase 1, RN01).
Decisões de distribuição: `docs/adr/0001-migracao-para-react-native.md` ("Decisão de distribuição").

## 1. Dor do usuário

O dono do projeto quer um APK instalável em aparelho Android, para testar o app
contra a API antes de qualquer conta de loja.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|----------------|--------|-----------|
| CA01 | Login pelo app grava a sessão no armazenamento seguro e devolve o usuário | teste | ✅ | `apps/mobile/src/services/auth.ts:8`, `apps/mobile/__tests__/auth.test.ts:34` |
| CA02 | Sair encerra no servidor e limpa a sessão local, mesmo sem rede | teste | ✅ | `apps/mobile/src/services/auth.ts:20`, `apps/mobile/__tests__/auth.test.ts:77` |
| CA03 | 401 de quem tinha token encerra a sessão; 403 não | teste | ✅ | `apps/mobile/src/services/api.ts:46`, `apps/mobile/__tests__/api.test.ts:39`, `apps/mobile/__tests__/api.test.ts:55` |
| CA04 | O token fica no armazenamento seguro, não no código | teste | ✅ | `apps/mobile/src/services/storage.ts:31`, `apps/mobile/__tests__/storage.test.ts:22` |
| CA05 | A API configurada entra no bundle (`EXPO_PUBLIC_API_URL`) | build | ✅ | `apps/mobile/src/config.ts:3`; bundle exportado com o endereço (`npx expo export --platform android`) |
| CA06 | Tráfego HTTP em texto claro liberado só para o build de teste | build | ✅ | `apps/mobile/app.json:25` (plugin `expo-build-properties`) |
| CA07 | Tipos estritos e testes passam | comando | ✅ | `apps/mobile/package.json:10` (`npm test`, 11 de 11) e `apps/mobile/package.json:11` (`npm run typecheck`) |
| CA08 | APK Android gerado e assinado | build + `apksigner verify` + `aapt2 dump badging` | ✅ | procedimento: `apps/mobile/README.md:19`; evidência: seção 8.1 |
| CA09 | APK sem permissões que o app não usa | `aapt2 dump badging` | ✅ | `apps/mobile/app.json:11`; evidência: seção 8.2 |
| CA10 | Layout com a identidade visual da web (cores, cartão, grade, busca, chips, rótulos do login) | leitura do código e comparação com a web | 🟡 | cores em `apps/mobile/src/theme.ts:5`; cartão em `apps/mobile/src/components/ProductCard.tsx:8`; grade em `apps/mobile/src/screens/CatalogScreen.tsx:125`; rótulos em `apps/mobile/src/screens/LoginScreen.tsx:53`; sem comparação visual em aparelho |
| CA11 | Usabilidade mobile: alvos de toque ≥ 48 dp, puxar para atualizar, estados de carregando, vazio e erro com nova tentativa, teclado sem cobrir campos | leitura do código e teste da lógica | ✅ | alvo mínimo em `apps/mobile/src/theme.ts:23`; atualizar em `apps/mobile/src/screens/CatalogScreen.tsx:130`; estados em `apps/mobile/src/screens/CatalogScreen.tsx:152`; regras de busca e preço testadas em `apps/mobile/__tests__/catalog.test.ts:13` |
| CA12 | Modo offline: "Continuar offline" abre o catálogo sem conta e sem rede; só cai no catálogo embutido por falha de rede com a lista vazia; sem conta, "Entrar" não chama o logout; foto que não carrega vira emoji | teste da regra + leitura do código | ✅ | botão em `apps/mobile/src/screens/LoginScreen.tsx:94`; regra em `apps/mobile/src/lib/catalog.ts:50`, usada em `apps/mobile/src/screens/CatalogScreen.tsx:55`; sem logout em `apps/mobile/src/screens/CatalogScreen.tsx:73`; catálogo em `apps/mobile/src/data/offline-catalog.ts:10`; testes em `apps/mobile/__tests__/offline.test.ts:19` e `:31`; foto em `apps/mobile/src/components/ProductCard.tsx:16` |
| CA13 | Cadastro pelo app (perfil, nome, e-mail, propriedade opcional, senha) com a conta já logada; só os perfis que o servidor aceita | teste | ✅ | serviço em `apps/mobile/src/services/auth.ts:27`; tela em `apps/mobile/src/screens/RegisterScreen.tsx:35`; perfis em `apps/mobile/src/lib/forms.ts:6`; testes em `apps/mobile/__tests__/auth.test.ts:97`, `:120` e `apps/mobile/__tests__/forms.test.ts:14` |
| CA14 | Tela de entrada com rótulos sempre visíveis, atalhos para criar conta e continuar offline, e a versão instalada à vista | leitura do código | 🟡 | rótulos em `apps/mobile/src/screens/LoginScreen.tsx:53`; atalhos em `apps/mobile/src/screens/LoginScreen.tsx:93` e `:94`; versão em `apps/mobile/src/screens/LoginScreen.tsx:98` (de `apps/mobile/app.json:5`); não vista em aparelho |
| CA15 | Recuperar senha pelo app | — | 🔴 | bloqueado: não há endpoint na API (spec 05) nem serviço de e-mail; ver seção 8 |

## 3. Contratos (antes do código)

- Endpoints usados: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/products`
  (`.ai/specs/05-openapi-spec.md`). Nenhum endpoint novo.
- Sessão local: `{ token, user }` no armazenamento seguro, chave `agrotech_session`.
- Endereço da API: `EXPO_PUBLIC_API_URL`, lido no build.

## 4. Decisões técnicas

- **Isolado dos workspaces:** `apps/mobile` tem lockfile próprio (ADR-0002, desvio registrado).
- **Sem `@react-navigation` nesta fase:** duas telas com troca de estado. A navegação
  real entra na Fase 1 completa (ADR-0001 cita a biblioteca).
- **Build local, sem EAS:** o EAS exige conta Expo. O Gradle roda na máquina, com o SDK do usuário.
- **Dependências novas** (todas com `npm view` conferido): `expo-build-properties@~58.0.12`
  (cleartext; o `app.json` sozinho não liga essa opção no Expo 58), `expo-secure-store@~58.0.3`,
  `expo-status-bar@~58.0.5`, `@types/node@^22.20.5`, e as do template (`expo`, `react`,
  `react-native`, `typescript`, `@types/react`).
- **Correção do spike:** a sessão só é encerrada em 401 de quem tinha token (igual à web).
  O spike encerrava também em 403; o item estava na lista da Fase 1 da #62.
- **Correção achada pelo teste:** `logout()` propagava o erro de rede; agora sai mesmo sem rede.

## 5. Must have

- CA01 a CA09 e CA12 a CA14 acima.

## 6. Nice to have

- Catálogo com busca e filtros (Fase 2).

## 7. Fonte de verdade em caso de divergência

A spec 08 manda no escopo da Fase 1; este blueprint manda no "como".

## 8. Divergências / achados durante a implementação

- **iOS não entregue.** Critério da #62 ("Android e iOS") fica registrado como divergência
  (ADR-0001, decisão de distribuição). Sem Mac e sem conta Apple.
- **Build de viabilidade fora do repositório:** o primeiro build falhou por SDK sem permissão
  de escrita (`C:\Program Files (x86)\Android\android-sdk`) e por NDK ausente. Resolvido com um SDK
  próprio em `C:\Users\Rooselt\Android\Sdk`, sem permissão de administrador.
- **`local.properties`:** o caminho do SDK precisa de barras normais (`C\:/Users/...`); com barras
  invertidas o Gradle falha ao ler o arquivo.
- **Assinatura:** o APK sai com a chave de depuração do React Native. Não é para publicar.
- **Layout e identidade visual (CA10).** A paleta, o cartão, a grade de 2 colunas, a busca, os chips de categoria e os rótulos do login vêm da web. A fonte da web (Outfit) não entrou: o app usa a fonte do sistema, para não adicionar dependência. Não há comparação visual em aparelho; a verificação é de código.
- **Skill de UI/UX mobile:** não há skill dessa área instalada. Os princípios de usabilidade mobile (alvos de toque, estados, teclado, puxar para atualizar) foram aplicados direto no código.
- **Offline é um catálogo embutido, não o cache da ADR-0001.** A política da ADR-0001 pede o "catálogo já consultado" em cache, com data e aviso de desatualização. O app traz um instantâneo fixo dos 4 produtos de demonstração (copiados à mão, só com os campos do cartão: sem dono, comentário nem foto) e mostra a data dele. O cache do que o usuário de fato consultou exige armazenamento persistente (`@react-native-async-storage/async-storage`, dependência nativa nova e outra rebuild completa) e continua na Fase 3 da spec 08. Isto antecipa só a entrada offline; carrinho, pedido e fila seguem fora.
- **Recuperação de senha não entregue (CA15).** A API não tem endpoint para isso e o projeto não tem serviço de e-mail. Entregar exige primeiro a spec 05 (endpoint, validade e uso único do token, sem revelar se o e-mail existe) e a escolha de como o usuário recebe o código. Sem isso, um link no app seria um beco sem saída, então não foi colocado.
- **Achado fora do escopo: o servidor não tem política de senha.** `POST /api/auth/register` aceita senha de 1 caractere (`apps/api/server.js:411`). O app só exige que não esteja vazia, como a web. Definir o mínimo é decisão de `apps/api` e da spec 05.
- **Versão 0.1.1 (`versionCode` 2).** O APK 0.1.0 não tinha os rótulos do login nem os atalhos, e os dois builds tinham o mesmo `versionCode`, então não dava para saber qual estava instalado. A versão agora aparece no rodapé do login.
- **Não testado em aparelho.** A verificação é de build e de assinatura; instalar e rodar no celular
  é passo do dono do projeto.
- **Permissões extras (resolvido).** O APK pedia `READ/WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`,
  `VIBRATE`, `USE_BIOMETRIC` e `USE_FINGERPRINT`, que o app não usa. O manifesto gerado pelo prebuild
  declara as três primeiras; as biométricas vêm do `androidx.biometric`. Bloqueadas em
  `apps/mobile/app.json:11` a `:17` (`android.blockedPermissions`, suportado pelo Expo 58). Verificação
  do APK novo na seção 8.2.
- **IP da API a confirmar.** O endereço gravado no APK é `10.210.61.27:3001` (Ethernet 2). O
  adaptador Wi-Fi não apareceu com IPv4 na verificação. Se o celular não alcançar esse endereço, gerar de
  novo com `EXPO_PUBLIC_API_URL` correto. A API precisa estar rodando (`npm start`) e a porta 3001
  liberada no firewall do Windows.

### 8.1 Evidência do APK

- Arquivo: `C:\Users\Rooselt\AgroTech-APK\agrotech-0.1.0.apk`, 66.580.089 bytes, SHA-256
  `13310c0ecbcd6512ed8c15966186bf21a1bf96c60eb1d629bc1e50c10ffea09d`.
- `apksigner verify`: válido pelo esquema v2. Assinado com a chave de depuração (`CN=Android Debug`).
- `aapt2 dump badging`: pacote `br.com.agrotech.app`, `versionCode` 1, `versionName` 0.1.0, rótulo
  "AgroTech", atividade `MainActivity`, `compileSdk` 37, `targetSdk` 36.
- Manifesto: `usesCleartextTraffic=true`.
- Bundle (`assets/index.android.bundle`): contém o endereço da API e as rotas `/auth/login`,
  `/auth/logout` e `/products`. Gerado às 20:02:33, depois da cópia da correção do logout (20:01:26).
  O bundle é bytecode do Hermes, então a verificação do texto da correção é indireta (pela data).
- Build: `./gradlew assembleRelease` com JDK 17 e SDK em `C:\Users\Rooselt\Android\Sdk`
  (platform 37, build-tools 35.0.0, NDK 27.1.12297006, CMake 3.22.1). `BUILD SUCCESSFUL` em 14 min 41 s.
- Não instalado nem executado em aparelho.

### 8.3 Evidência do APK com o layout novo

Arquivo atual: `C:\Users\Rooselt\AgroTech-APK\agrotech-0.1.0.apk`, 66.589.385 bytes, SHA-256
`900b2048459f158f2fee793d38631d3197c7078b3dec5b6dfb41b2157c65eb4c`.

- `aapt2 dump badging`: pacote `br.com.agrotech.app`, permissão `INTERNET` apenas.
- `apksigner verify`: válido (chave de depuração).
- Bundle: contém os textos das telas novas (login, busca, chips, estados) e o endereço da API.
- Build: `BUILD SUCCESSFUL` em 3 min 04 s (incremental).
- Não instalado nem visto em aparelho: a comparação visual com a web é de código (CA10).

### 8.2 Evidência do APK sem permissões extras

O APK de 8.1 foi substituído pelo build seguinte (mesma versão, `versionCode` 1). Arquivo atual:
`C:\Users\Rooselt\AgroTech-APK\agrotech-0.1.0.apk`, 66.579.973 bytes, SHA-256
`f9df7d5d7e459c680c7dbdbcfcb4e4ab004fd4f8601936dd5867cfbbe4357097`.

- `aapt2 dump badging`: única permissão declarada `android.permission.INTERNET` (mais a
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, interna do Android, sem pedido ao usuário).
- `apksigner verify`: válido (chave de depuração), pacote `br.com.agrotech.app` inalterado.
- Build: `BUILD SUCCESSFUL` em 14 min 44 s.
