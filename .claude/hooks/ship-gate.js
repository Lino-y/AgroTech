#!/usr/bin/env node
// PreToolUse(Bash) — exige CONFIRM_SHIP=1 explicito no comando antes de qualquer
// push/PR/merge para o GitHub. Tudo mais (commit local, branch, docker, etc.)
// passa livre. Force-push para main/master é sempre bloqueado, mesmo com CONFIRM_SHIP.
const readStdin = () => new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

const SHIP_PATTERNS = [/\bgit\s+push\b/, /\bgh\s+pr\s+create\b/, /\bgh\s+pr\s+merge\b/];
const FORCE_TO_MAIN = /\bgit\s+push\b[^&|;]*(--force|-f\b)[^&|;]*\b(origin\s+)?(main|master)\b/;

(async () => {
  const input = await readStdin();
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }
  const command = payload?.tool_input?.command || '';

  if (FORCE_TO_MAIN.test(command)) {
    console.error('[ship-gate] Force-push em main/master nunca é permitido. Abra um PR normal.');
    process.exit(2);
  }

  const needsShip = SHIP_PATTERNS.some((re) => re.test(command));
  if (needsShip && !command.includes('CONFIRM_SHIP=1')) {
    console.error(
      '[ship-gate] Push/PR/merge para o GitHub precisa de confirmação explícita.\n' +
        'Prefixe o comando com CONFIRM_SHIP=1, ex: CONFIRM_SHIP=1 git push origin HEAD'
    );
    process.exit(2);
  }

  process.exit(0);
})();
