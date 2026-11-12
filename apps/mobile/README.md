# AgroTech mobile (Android)

Cliente React Native + Expo do AgroTech. Escopo atual (Fase 1, ADR-0001): login e
catálogo somente leitura, só Android, distribuído como APK instalado manualmente.
Sem contas de loja e sem iOS por enquanto.

## Gerar o APK

Pré-requisitos na máquina: Node 22.13 ou superior, JDK 17, Android SDK com
platform 37, build-tools 35 e NDK 27.1.12297006 (o Gradle baixa o que faltar,
se a pasta do SDK for gravável).

```bash
cd apps/mobile
npm install
# Endereço da API que o APK vai usar (IP da máquina na rede do celular):
export EXPO_PUBLIC_API_URL=http://192.168.0.10:3001
npx expo prebuild -p android --no-install --clean
cd android && ./gradlew assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`.

A pasta `android/` é gerada pelo `prebuild` e não se versiona. O endereço da API
fica gravado no APK no momento do build: para mudar de rede, gere de novo.

Ícone: `assets/icon.png` e `assets/adaptive-icon.png` (1024×1024) saem de `assets/logo.svg`. O
trator fica branco; no ícone comum, o fundo é o verde da marca `#2E7D32`. No adaptável, a frente é
transparente, o trator cabe na área segura central de 66% e o verde vem do `backgroundColor` do
`app.json`. Trocou o ícone? Rode o `prebuild --clean`, que gera os `mipmap` no projeto nativo, e
apague `android/app/build/generated/res/react/release` antes do build.

Cuidado: o Gradle não vê a troca de `EXPO_PUBLIC_API_URL` como mudança e reaproveita o bundle
antigo (o build termina em segundos, com o endereço velho dentro). Ao trocar o endereço, force o
bundle: `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease`.

No Windows, o código nativo do `react-native-safe-area-context` gera caminhos com mais de 260
caracteres, e o `ninja` do CMake 3.22.1 não aceita caminho longo. Use o CMake 3.31.6 do SDK (traz o
`ninja` 1.12.1) e aponte para ele no `android/local.properties`:
`cmake.dir=C\:/Users/<você>/Android/Sdk/cmake/3.31.6`. Gere o build numa pasta de caminho curto
(por exemplo `C:\b`) e deixe ligado o `LongPathsEnabled` do Windows.

O app importa as regras de `packages/domain` (ADR-0002) pelo caminho relativo `../../packages/domain`.
Numa pasta de build fora do repositório, espelhe o layout: `C:\b\apps\mobile` (o app) e
`C:\b\packages\domain` (o domínio). Sem isso o Metro não acha os imports.

## Limitações conhecidas

- O APK é assinado com a chave de depuração do React Native (não há keystore de
  produção). Serve para instalar e testar, não para publicar.
- `android.package` é provisório (`br.com.agrotech.app`); definir o definitivo
  antes de qualquer distribuição.
- O tráfego em HTTP é permitido (`expo-build-properties`, `usesCleartextTraffic`),
  por causa da rede local. Produção pede HTTPS.
- Não há iOS: não há Mac nem conta Apple (registrado na ADR-0001).

## Testes

```bash
npm test        # serviços (API, storage, auth), no Node: sem React Native
npm run typecheck
```
