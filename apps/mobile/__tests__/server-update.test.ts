// Endereço do servidor configurável no app e aviso de versão nova (download pela API).
import test from 'node:test';
import assert from 'node:assert/strict';
import { API_URL } from '../src/config.ts';
import { availableUpdate, normalizeServerUrl } from '../src/lib/server.ts';
import { apiRequest, getApiBaseUrl, setApiBaseUrl } from '../src/services/api.ts';

test('endereço digitado vira a URL base: põe http://, tira barra final e /api colado', () => {
  assert.equal(normalizeServerUrl('192.168.1.34:3001'), 'http://192.168.1.34:3001');
  assert.equal(normalizeServerUrl(' http://192.168.1.34:3001/ '), 'http://192.168.1.34:3001');
  assert.equal(normalizeServerUrl('http://192.168.1.34:3001/api'), 'http://192.168.1.34:3001');
  assert.equal(normalizeServerUrl('https://agrotech.exemplo.com.br/api/'), 'https://agrotech.exemplo.com.br');
  assert.equal(normalizeServerUrl('localhost:3996/api/'), 'http://localhost:3996', 'nome com porta não é protocolo');
  assert.equal(normalizeServerUrl('agrotech.local:3001'), 'http://agrotech.local:3001');
  assert.equal(normalizeServerUrl('ftp://192.168.1.34'), null);
  assert.equal(normalizeServerUrl('javascript:alert(1)'), null);
  assert.equal(normalizeServerUrl(''), null);
  assert.equal(normalizeServerUrl('http://'), null);
});

test('as requisições usam o endereço salvo; sem ele, o do APK', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    setApiBaseUrl('http://10.0.0.5:3001');
    assert.equal(getApiBaseUrl(), 'http://10.0.0.5:3001');
    await apiRequest('/health');
    setApiBaseUrl(null);
    assert.equal(getApiBaseUrl(), API_URL);
    await apiRequest('/health');
  } finally {
    globalThis.fetch = original;
    setApiBaseUrl(null);
  }
  assert.deepEqual(urls, ['http://10.0.0.5:3001/api/health', `${API_URL}/api/health`]);
});

test('aviso de versão nova só quando a do servidor é maior e há download', () => {
  const config = { minVersion: '0.0.0', latestVersion: '0.4.2', downloadUrl: '/api/app-download' };
  assert.deepEqual(availableUpdate(config, '0.4.1', 'http://192.168.1.34:3001'), {
    version: '0.4.2',
    url: 'http://192.168.1.34:3001/api/app-download'
  });
  assert.equal(availableUpdate(config, '0.4.2', 'http://x'), null, 'mesma versão');
  assert.equal(availableUpdate(config, '0.5.0', 'http://x'), null, 'app mais novo que o anunciado');
  assert.equal(availableUpdate({ ...config, downloadUrl: null }, '0.4.1', 'http://x'), null, 'sem arquivo para baixar');
  assert.equal(availableUpdate({ minVersion: '0.0.0', latestVersion: null, downloadUrl: null }, '0.4.1', 'http://x'), null);
  assert.equal(availableUpdate({ ...config, latestVersion: 'lixo' }, '0.4.1', 'http://x'), null, 'versão inválida não avisa');
});
