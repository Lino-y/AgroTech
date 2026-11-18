import { readFileSync, writeFileSync } from 'node:fs';
let t = readFileSync('tests/coverage-gap.test.js', 'utf8');
t = t.replace(
  "milho para plantio, 40 toneladas, R$ 320, em Rio Verde - GO, com laudo e nota fiscal",
  "milho para plantio, 40 toneladas, R$ 320, em Rio Verde - GO, com laudo, nota fiscal e registro mapa"
);
writeFileSync('tests/coverage-gap.test.js', t);
console.log('done');
