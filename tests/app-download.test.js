// Versão nova do app e download do APK pela API (spec 05): /api/app-config informa latestVersion e
// downloadUrl; /api/app-download entrega o único arquivo configurado. Comparação de versão no domínio.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareVersions, isValidVersion } from '../packages/domain/version.js';
import { readLatestVersion } from '../apps/api/app-version.js';
import { startServer } from './helpers/start-server.js';

test('compara versões MAJOR.MINOR.PATCH numericamente', () => {
  assert.equal(compareVersions('0.4.1', '0.4.0'), 1);
  assert.equal(compareVersions('0.4.0', '0.4.0'), 0);
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1, '10 > 9, não ordem de texto');
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(isValidVersion('1.2.3'), true);
  assert.equal(isValidVersion('1.2'), false);
  assert.equal(isValidVersion('v1.2.3'), false);
});

test('versão mais nova: ausente é null; fora do formato é erro (o servidor não sobe)', () => {
  assert.deepEqual(readLatestVersion(undefined), { version: null });
  assert.deepEqual(readLatestVersion('0.4.1'), { version: '0.4.1' });
  assert.ok('error' in readLatestVersion('0.4'));
  assert.ok('error' in readLatestVersion(''));
});

let dir;
let withApk;
let withoutApk;
const APK_BYTES = Buffer.from('PK-apk-de-teste');

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'agrotech-apk-'));
  const apk = path.join(dir, 'agrotech-teste.apk');
  writeFileSync(apk, APK_BYTES);
  withApk = await startServer({
    env: { DATA_FILE: path.join(dir, 'db1.json'), JWT_SECRET: '', APP_LATEST_VERSION: '0.4.1', APP_APK_FILE: apk }
  });
  withoutApk = await startServer({
    env: { DATA_FILE: path.join(dir, 'db2.json'), JWT_SECRET: '', APP_LATEST_VERSION: undefined, APP_APK_FILE: undefined }
  });
});

after(() => {
  withApk.kill();
  withoutApk.kill();
  rmSync(dir, { recursive: true, force: true });
});

test('app-config informa a versão mais nova e o caminho do download', async () => {
  const config = await (await fetch(`${withApk.base}/api/app-config`)).json();
  assert.equal(config.latestVersion, '0.4.1');
  assert.equal(config.downloadUrl, '/api/app-download');
  const none = await (await fetch(`${withoutApk.base}/api/app-config`)).json();
  assert.equal(none.latestVersion, null);
  assert.equal(none.downloadUrl, null);
});

test('o download entrega o APK configurado como pacote Android', async () => {
  const res = await fetch(`${withApk.base}/api/app-download`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/vnd.android.package-archive');
  assert.match(res.headers.get('content-disposition') ?? '', /agrotech-0\.4\.1\.apk/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), APK_BYTES);
});

test('a requisição não troca o arquivo entregue', async () => {
  const res = await fetch(`${withApk.base}/api/app-download?file=../apps/api/server.js`);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), APK_BYTES);
});

test('sem APK configurado o download é 404; app desatualizado também consegue baixar', async () => {
  assert.equal((await fetch(`${withoutApk.base}/api/app-download`)).status, 404);
  const old = await fetch(`${withApk.base}/api/app-download`, { headers: { 'X-App-Version': '0.0.1' } });
  assert.equal(old.status, 200);
});
