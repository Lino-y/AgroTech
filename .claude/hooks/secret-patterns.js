// Padrões de credencial reusados por secret-scan.js (diff de commit) e
// secret-in-prompt.js (mensagem digitada no chat).
module.exports = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: 'Anthropic Key', re: /sk-ant-[A-Za-z0-9-]{20,}/ },
  { name: 'OpenAI Key', re: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Slack Webhook', re: /hooks\.slack\.com\/services\/[A-Za-z0-9/]+/ },
  { name: 'Postgres URL com senha', re: /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/ },
  { name: 'JWT / Supabase key', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];
