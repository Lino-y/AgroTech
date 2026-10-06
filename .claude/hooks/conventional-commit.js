#!/usr/bin/env node
// PreToolUse(Bash) — valida a mensagem de `git commit -m` contra Conventional
// Commits. Já era exigido em .ai/templates/commit-pr-template.md, mas nunca
// era checado de fato.
const readStdin = () => new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

const TYPE_RE = /^(feat|fix|docs|refactor|perf|test|chore|build|ci|style|revert)(\([\w.-]+\))?!?: .+/;

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

  // -m "literal" / -m 'literal' de uma linha só.
  const simple = command.match(/-m\s+"([^"\n]+)"|-m\s+'([^'\n]+)'/);
  // -m "$(cat <<'EOF' ... EOF)" heredoc: a primeira linha do corpo é o subject.
  const heredoc = command.match(/<<[-~]?\s*['"]?(\w+)['"]?\r?\n([^\r\n]*)\r?\n/);

  const message = simple ? (simple[1] ?? simple[2]) : heredoc ? heredoc[2] : null;
  if (message === null) process.exit(0); // -F <file>, editor interativo etc.: não dá para validar aqui
  if (!TYPE_RE.test(message)) {
    console.error(
      `[conventional-commit] Mensagem fora do padrão: "${message}"\n` +
        'Use: tipo(escopo): descrição — tipos: feat|fix|docs|refactor|perf|test|chore|build|ci|style|revert'
    );
    process.exit(2);
  }

  process.exit(0);
})();
