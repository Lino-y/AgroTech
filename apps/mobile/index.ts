import { registerRootComponent } from 'expo';
import { Appearance } from 'react-native';

// O tema (claro ou escuro) é decidido aqui, antes de as telas criarem os estilos (ver src/theme.ts).
(globalThis as { agroColorScheme?: string }).agroColorScheme = Appearance.getColorScheme() ?? 'light';

// require depois da linha acima: um import seria avaliado antes dela.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const App = require('./src/App').default;

registerRootComponent(App);
