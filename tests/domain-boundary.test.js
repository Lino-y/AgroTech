// ADR-0002 (passo A1): packages/domain é puro e único. Não importa nada de fora dele (nem src/, nem
// server.js) e as regras de comércio e finanças não têm segunda cópia em src/services/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const DOMAIN = new URL('../packages/domain/', import.meta.url);
const SHARED = ['commerce', 'finance', 'catalog'];

test('o domínio só importa arquivos do próprio domínio', () => {
  const files = readdirSync(DOMAIN).filter((name) => name.endsWith('.js'));
  assert.deepEqual(files.sort(), SHARED.map((name) => `${name}.js`).sort());
  for (const name of files) {
    const source = readFileSync(new URL(name, DOMAIN), 'utf8');
    const specifiers = [...source.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of specifiers) {
      assert.match(specifier, /^\.\/[\w-]+\.js$/, `${name} importa ${specifier}, que está fora do domínio`);
    }
  }
});

test('commerce, finance e catalog têm um lugar só (sem cópia em src/services)', () => {
  for (const name of SHARED) {
    assert.equal(existsSync(new URL(`${name}.js`, DOMAIN)), true, `${name}.js sumiu do domínio`);
    assert.equal(existsSync(new URL(`../../src/services/${name}.js`, import.meta.url)), false, `${name}.js voltou para src/services`);
  }
});
