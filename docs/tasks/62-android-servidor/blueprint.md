# Blueprint: servidor configurável no app e versão nova com download (#62)

Spec: issue #62, `.ai/specs/05-openapi-spec.md` (`/api/app-config` e `/api/app-download`) e
`.ai/specs/08-migracao-react-native.md` (RN09, RN11). Pedido do dono: "prioridade alta e que já agrega
valor pro Android". PR para a `main`, depois da #86 e da #87.

## 1. Dor do usuário

- O endereço da API ficava gravado no APK: cada troca de rede do PC pedia outro APK (aconteceu três
  vezes nesta fase, uma delas quase saiu com o IP antigo por causa do bundle reaproveitado).
- Cada versão nova do APK era copiada à mão para o celular; a tela do 426 mandava instalar o APK novo
  sem dizer onde.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | O app troca o servidor sem novo APK: endereço normalizado (só http/https), testado em /api/health antes de salvar, salvo no aparelho e aplicado antes da primeira requisição | teste + fumaça | ✅ | `apps/mobile/src/lib/server.ts:8`, `apps/mobile/src/screens/ServerScreen.tsx:30`, `apps/mobile/src/services/api.ts:45`, `apps/mobile/src/App.tsx:61`; `apps/mobile/__tests__/server-update.test.ts:8`, `apps/mobile/__tests__/server-update.test.ts:21` |
| CA02 | Trocar de servidor encerra a sessão, apaga o catálogo salvo e avisa se há anúncios na fila do servidor antigo | leitura do código | 🟡 | `apps/mobile/src/App.tsx:140`; não visto em aparelho |
| CA03 | Atalho "Configurar servidor" no erro de conexão do catálogo e o servidor em uso na Conta | leitura do código | 🟡 | `apps/mobile/src/screens/CatalogScreen.tsx:185`; não visto em aparelho |
| CA04 | A API informa a versão mais nova e o caminho do APK (`APP_LATEST_VERSION`, `APP_APK_FILE`); sem configuração, null | teste de API | ✅ | `apps/api/server.js:435`; `tests/app-download.test.js:52` |
| CA05 | `/api/app-download` entrega só o APK configurado, como pacote Android, liberado para app abaixo da mínima; 404 sem arquivo | teste de API | ✅ | `apps/api/server.js:442`; `tests/app-download.test.js:61`, `tests/app-download.test.js:69` |
| CA06 | O app avisa "Nova versão X disponível — Baixar" só quando a da API é maior, e a tela do 426 ganha "Baixar versão nova" | teste + fumaça | ✅ | `apps/mobile/src/lib/server.ts:27`, `apps/mobile/src/App.tsx:87`, `apps/mobile/src/screens/CatalogScreen.tsx:158`, `apps/mobile/src/screens/UpdateScreen.tsx:24`; `apps/mobile/__tests__/server-update.test.ts:42` |
| CA07 | Comparação de versões num lugar só, usada pela API e pelo app | teste | ✅ | `packages/domain/version.js:18`; `tests/app-download.test.js:12` |

## 3. Contratos (antes do código)

Spec 05: `/api/app-config` ganha `latestVersion` e `downloadUrl` (nulos sem configuração) e entra
`GET /api/app-download`. Variáveis novas do servidor: `APP_LATEST_VERSION` (MAJOR.MINOR.PATCH; fora
do formato derruba a subida) e `APP_APK_FILE` (caminho absoluto de um .apk). No aparelho, a chave
`server` guarda o endereço escolhido.

## 4. Decisões técnicas

- **Sem dependência nova:** o download abre no navegador (`Linking`); o Android instala o APK. Nenhuma
  permissão nova no app.
- **O link do APK é o servidor em uso + `downloadUrl`:** funciona junto com o servidor configurável.
- **Limite da configuração de servidor (ponytail em `apps/mobile/src/services/server.ts:2`):** qualquer
  pessoa pode apontar o app para outro servidor e digitar a senha lá. Vale para a fase de testes na rede
  local; esconder ou tirar antes de distribuir para produtores.

## 5. Must have

- CA01, CA04 a CA07.

## 6. Nice to have

- Publicar a API fora do PC (hospedagem), para o app funcionar longe do Wi-Fi do escritório.

## 7. Fonte de verdade em caso de divergência

Spec 05 no contrato; este blueprint no "como".

## 8. Divergências / achados durante a implementação

- **Fumaça contra API real** (porta separada, com versão nova e um APK de teste configurados): o endereço
  digitado com /api e barra final virou a URL certa, o teste de conexão aceitou o certo e recusou porta
  errada, o app passou a usar o servidor novo, o aviso apontou a versão nova e o link baixou o arquivo
  como pacote Android. Ela achou um erro corrigido antes do commit: endereço com nome e porta
  (`localhost:3996`) era lido como protocolo.
- **Testes antigos do /api/app-config** comparavam o corpo exato e foram atualizados para os dois
  campos novos (`tests/app-config.test.js`, `tests/helpers/start-server.test.js`).
