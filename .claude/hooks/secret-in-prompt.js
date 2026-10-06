#!/usr/bin/env node
// UserPromptSubmit — se a mensagem que você está mandando parece conter uma
// credencial real, bloqueia antes de virar contexto e avisa para rotacionar.
// Limite honesto: isso não apaga o que já foi digitado do transcript local
// da sessão. A defesa de verdade é nunca colar o valor aqui — ver CLAUDE.md.
const SECRET_PATTERNS = require('./secret-patterns');

const readStdin = () => new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

(async () => {
  const input = await readStdin();
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  const prompt = payload?.prompt || '';

  const hits = SECRET_PATTERNS.filter(({ re }) => re.test(prompt));
  if (hits.length) {
    console.error(
      `[secret-in-prompt] Isso parece conter uma credencial real (${hits.map((h) => h.name).join(', ')}).\n` +
        '1) Rotacione essa key agora — ela já foi digitada nesta conversa.\n' +
        '2) Da próxima vez, coloque o valor direto no .env (fora do chat) e me diga só o NOME da variável.'
    );
    process.exit(2);
  }

  process.exit(0);
})();
