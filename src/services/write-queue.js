// @ts-check

/**
 * Fila de uma vez só: cada requisição que grava no db.json espera a anterior terminar, então a rota
 * lê, altera e grava sem outra gravação no meio (senão uma perde o que a outra gravou).
 *
 * A vez de quem desiste antes de começar (cliente que cai enquanto espera) só conta depois que a
 * anterior terminou: devolver a vez cedo demais soltaria quem vem atrás junto com quem ainda roda.
 * @returns {{ acquire: () => { turn: Promise<void>, release: () => void } }}
 */
export function createTurnQueue() {
  /** @type {Promise<void>} */
  let tail = Promise.resolve();

  return {
    /**
     * `turn` resolve quando for a vez; `release` devolve a vez (pode ser chamado mais de uma vez, e a
     * qualquer hora, inclusive antes de a vez chegar).
     */
    acquire() {
      const previous = tail;
      /** @type {() => void} */
      let release = () => {};
      /** @type {Promise<void>} */
      const mine = new Promise((resolve) => {
        release = () => resolve();
      });
      tail = previous.then(() => mine);
      return { turn: previous, release };
    }
  };
}
