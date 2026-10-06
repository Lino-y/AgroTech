#!/usr/bin/env node
// PreToolUse(Bash) — antes de `git commit`, varre o diff staged atrás de
// segredos óbvios (chaves de API, tokens, URLs de banco com senha). Não
// substitui um scanner de verdade (gitleaks etc.), é a rede mínima antes do
// commit sair da máquina.
const { execSync } = require('child_process');
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
  const command = payload?.tool_input?.command || '';
  if (!/\bgit\s+commit\b/.test(command)) process.exit(0);

  let diff = '';
  try {
    diff = execSync('git diff --cached -U0', { cwd: payload.cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    process.exit(0); // sem repo/staged diff acessível: não trava o commit por isso
  }

  const hits = SECRET_PATTERNS.filter(({ re }) => re.test(diff));
  if (hits.length) {
    console.error(
      `[secret-scan] Possível segredo no diff staged: ${hits.map((h) => h.name).join(', ')}.\n` +
        'Remova do diff (git restore --staged <arquivo>) antes de commitar.'
    );
    process.exit(2);
  }

  process.exit(0);
})();
