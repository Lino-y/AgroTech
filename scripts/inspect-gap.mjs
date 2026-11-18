import { readFileSync } from 'node:fs';
const t = readFileSync('tests/coverage-gap.test.js', 'utf8').split('\n');
for (let n = 352; n <= 370; n++) console.log(n + ':', t[n - 1]);
