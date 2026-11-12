# Blueprint: refactor de estilo do app com a skill ui-ux-pro-max (#62)

Spec: issue #62 (app mobile). Pedido do dono: instalar a skill `ui-ux-pro-max`
(github.com/nextlevelbuilder/ui-ux-pro-max-skill) e refazer o estilo do app com ela. PR empilhado
sobre o de comprar, vender e financeiro (`docs/tasks/62-app-fluxos/blueprint.md`).

## 1. Dor do usuário

O app funcionava, mas o visual não seguia boas práticas de app nativo: emoji como ícone, texto
secundário com pouco contraste, sem retorno ao toque, tamanhos e espaços soltos.

## 2. Critérios de aceite (rastreáveis)

| ID | Critério | Como verificar | Status | Evidência |
|----|----------|-----------------|--------|-----------|
| CA01 | Cores por papel (tokens semânticos), sem cor solta nas telas | teste + busca no código | ✅ | `apps/mobile/src/theme.ts:9`, `apps/mobile/src/theme.ts:18`; nenhum `rgba(`/hex fora de `theme.ts` e do catálogo embutido |
| CA02 | Texto com contraste >= 4,5:1 e contorno de controle >= 3:1 (WCAG), testado | teste | ✅ | `apps/mobile/__tests__/theme.test.ts:37`, `apps/mobile/__tests__/theme.test.ts:43` |
| CA03 | Ícones vetoriais de uma família só (Ionicons, contorno) no lugar de emoji nas abas, voltar, quantidade, carrinho vazio, excluir, busca, local e nota | leitura do código | ✅ | `apps/mobile/src/components/Icon.tsx:18`, `apps/mobile/src/components/TabBar.tsx:10`, `apps/mobile/src/screens/CatalogScreen.tsx:75`; dependências em `apps/mobile/package.json:14` e `:17` |
| CA04 | Retorno visual a todo toque (ripple no Android e opacidade), sem mexer no tamanho | leitura do código | ✅ | `apps/mobile/src/components/Tap.tsx:12` |
| CA05 | Aba ativa não depende só da cor (traço, peso do texto); gráfico do financeiro com legenda | leitura do código | ✅ | `apps/mobile/src/components/TabBar.tsx:38`, `apps/mobile/src/screens/FinanceScreen.tsx:102` |
| CA06 | Escalas de espaço (4/8 dp), texto (mínimo 12) e ícone como tokens | leitura do código | ✅ | `apps/mobile/src/theme.ts:38`, `apps/mobile/src/theme.ts:41`, `apps/mobile/src/theme.ts:44` |
| CA07 | Visual conferido em aparelho (telas pequena e grande, fonte grande do sistema) | aparelho | 🔴 | não feito: sem aparelho nem emulador neste PC |

## 3. Contratos (antes do código)

Nenhum: só estilo. Nenhuma tela, rota ou regra muda.

## 4. Decisões técnicas

- **Skill instalada no perfil do usuário**, não no repositório (`<config do Claude>/skills/ui-ux-pro-max`):
  é código de terceiros; antes de instalar, os scripts foram lidos (só biblioteca padrão do Python,
  sem rede nem processo externo; a única escrita é o `--persist`, que não foi usado).
- **Paleta:** a skill sugeriu verde-terra `#15803D` e dourado `#A16207` ("Organic Biophilic"). Ficaram
  as cores da web (o dono pediu o app parecido com a web), com a estrutura de tokens da skill e os
  tons ajustados onde o contraste falhava: texto secundário `#6C8574` (3,8:1) → `#52695A`, verde
  secundário `#388E3C` (3,9:1) → `#2A6F2E`, contorno de campo `#C8E6C9` (1,3:1) → `#6E9A79`.
- **Tipografia:** a skill sugeriu Fira Code/Fira Sans, com perfil "dashboard, técnico". Não combina com
  o público (produtor rural) e pediria fonte nova; ficou a fonte do sistema, com escala de tamanhos.
- **Ícones:** a família preferida da skill (Phosphor) depende de `react-native-svg` (nativa). As regras
  nativas da própria skill aceitam `@expo/vector-icons`, que usa o `expo-font`; as duas versões são as
  que o Expo 58 lista como compatíveis (`npm view` conferido). Só o Ionicons é importado.
- **Emoji do produto continua:** é a ilustração que o servidor manda (como na web), não ícone de
  controle; fica fora da leitura de tela.

## 5. Must have

- CA01 a CA06.

## 6. Nice to have

- Tema escuro; fonte da marca.

## 7. Fonte de verdade em caso de divergência

As regras da skill são recomendação: as do repositório e o pedido do dono mandam.

## 8. Divergências / achados durante a implementação

- **Só tema claro.** O tema Android gerado é `DayNight` sem escurecimento forçado: no modo escuro do
  sistema o app mantém as cores claras explícitas (só diálogos nativos escurecem). O checklist da skill
  pede testar os dois temas; o escuro não existe no app.
- **Checklist da skill não verificado em aparelho:** fonte grande do sistema, paisagem e tablet ficam
  para o teste no celular (CA07).
- **Busca da skill sem resultado** para ícones no catálogo de React Native; a nova tentativa no domínio
  de ícones trouxe a regra de família única e semântica de acessibilidade, aplicada aqui.

### 8.1 Evidência do APK 0.2.1

Arquivo: `C:/Users/Rooselt/AgroTech-APK/agrotech-0.2.1.apk` (substitui o 0.2.0), 67.679.486 bytes,
SHA-256 `acab23cdf6df0b0486f15302112fa5b28343494686661982a527e862c3ab84da`.

- `aapt2 dump badging`: `versionCode` 8, `versionName` 0.2.1, permissão `INTERNET` apenas. `apksigner verify`: válido.
- Dentro do APK: a fonte do Ionicons (`res/CU.ttf`, 389.724 bytes, só essa família) e o módulo nativo do
  `expo-font` (`classes.dex`). Bundle com os nomes dos ícones, as cores novas e sem `#6C8574`.
- Testes: app 69 de 69 (15 de contraste); raiz 241 de 241. `BUILD SUCCESSFUL` em 11 min 05 s.
- Não visto em aparelho (CA07).

