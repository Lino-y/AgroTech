#!/usr/bin/env node
// PreToolUse(Bash | Edit | Write) — bloqueia ações irreversíveis sem trocar
// autonomia por burocracia: docker/dados locais podem ser usados livremente,
// só as operações realmente destrutivas ficam de fora, sem opção de override.
const readStdin = () => new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

const DESTRUCTIVE_COMMANDS = [
  { re: /\bdocker\s+system\s+prune\b/, msg: 'docker system prune apaga imagens/volumes de outros projetos.' },
  { re: /\bdocker\s+volume\s+(rm|prune)\b/, msg: 'remover volume Docker pode apagar dados persistidos (ex: banco local).' },
  { re: /\bdocker[\s-]compose\b.*\bdown\b.*(-v|--volumes)\b/, msg: 'down -v apaga os volumes (dados do banco local).' },
  { re: /\brm\s+-rf\s+[^&|;]*\.git(\/|\b)/, msg: 'apaga o histórico git local.' },
  {
    re: /\b(psql|mysql|sqlite3|mongosh)\b[\s\S]*\b(DROP\s+(TABLE|DATABASE)|TRUNCATE)\b/i,
    msg: 'comando SQL destrutivo (DROP/TRUNCATE) rodando num cliente de banco.',
  },
];

const PROTECTED_PATHS = [/(^|\/)\.env(\.|$)/, /(^|\/)\.mcp\.json$/, /(^|\/)\.github\/workflows\//];

(async () => {
  const input = await readStdin();
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  if (payload.tool_name === 'Bash') {
    const command = payload?.tool_input?.command || '';
    for (const { re, msg } of DESTRUCTIVE_COMMANDS) {
      if (re.test(command)) {
        console.error(`[destructive-guard] Bloqueado: ${msg} Rode manualmente fora do agente se for intencional.`);
        process.exit(2);
      }
    }
  }

  if (payload.tool_name === 'Edit' || payload.tool_name === 'Write') {
    const filePath = payload?.tool_input?.file_path || '';
    if (filePath.endsWith('.env.example')) {
      process.exit(0);
    }
    if (PROTECTED_PATHS.some((re) => re.test(filePath))) {
      console.error(`[destructive-guard] Bloqueado: edição de "${filePath}" (credenciais/CI) precisa ser feita manualmente.`);
      process.exit(2);
    }
  }

  process.exit(0);
})();
