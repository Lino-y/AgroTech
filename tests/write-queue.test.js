// Fila de uma vez só das gravações do server.js (revisão): a vez de cada requisição só começa quando
// a anterior terminou, mesmo se alguém que ainda espera desistir (conexão que cai) antes da hora.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnQueue } from '../src/services/write-queue.js';

const settle = () => new Promise((resolve) => setImmediate(resolve));

function track(queue, name, log) {
  const turn = queue.acquire();
  turn.turn.then(() => log.push(name));
  return turn;
}

test('cada vez só começa depois que a anterior terminou, na ordem de chegada', async () => {
  const queue = createTurnQueue();
  const log = [];
  const a = track(queue, 'a', log);
  const b = track(queue, 'b', log);
  const c = track(queue, 'c', log);

  await settle();
  assert.deepEqual(log, ['a']);
  a.release();
  await settle();
  assert.deepEqual(log, ['a', 'b']);
  b.release();
  await settle();
  assert.deepEqual(log, ['a', 'b', 'c']);
  c.release();
});

test('quem desiste enquanto espera não adianta a vez de quem vem depois', async () => {
  const queue = createTurnQueue();
  const log = [];
  const a = track(queue, 'a', log);
  const b = track(queue, 'b', log);
  track(queue, 'c', log);

  await settle();
  b.release(); // o cliente de "b" caiu antes de a vez dele chegar
  await settle();
  assert.deepEqual(log, ['a'], '"c" começou junto com "a": a gravação de "a" corre risco de se perder');

  a.release();
  await settle();
  assert.deepEqual(log, ['a', 'b', 'c']);
});

test('devolver a vez duas vezes não libera a vez de quem espera', async () => {
  const queue = createTurnQueue();
  const log = [];
  const a = track(queue, 'a', log);
  const b = track(queue, 'b', log);
  track(queue, 'c', log);

  await settle();
  a.release();
  a.release();
  await settle();
  assert.deepEqual(log, ['a', 'b']);
  b.release();
});
