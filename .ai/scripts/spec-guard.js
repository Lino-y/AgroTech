#!/usr/bin/env node
// Guarda de spec (regra 09) para qualquer LLM ou pessoa — roda no pre-push
// (.githooks/pre-push). Ainda não há CI: `--no-verify` pula a guarda.
//
// 1. Linha nova de blueprint que marca algo como feito (`- [x]` ou célula `| ✅ |`)
//    precisa citar evidência `arquivo:linha` que exista.
// 2. Mudou código (src/, server.js ou index.html)? A mesma mudança atualiza .ai/specs/
//    ou docs/tasks/ — ou declara `Spec: n/a — <motivo>` no corpo do PR ou num commit.
//
// Uso: node .ai/scripts/spec-guard.js [base=origin/main] [head=HEAD]  (PR_BODY no ambiente)
const { execFileSync } = require('child_process');

// Qualquer `caminho.ext:linha` entre crases; quem valida é a checagem de existência abaixo.
const REF_RE = /`([^`\s:]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?`/g;
const DONE_RE = /^\s*(?:- \[x\] |\|.*\|\s*✅\s*\|)/;
const CODE_RE = /^(?:src\/|server\.js$|index\.html$)/;
const SPEC_RE = /^(?:\.ai\/specs\/|docs\/tasks\/)/;
const OPT_OUT_RE = /^\s*(?:[-*]\s*)?Spec:\s*n\/a\s*[—–-]\s*\S/im;

// fileLines(path) -> número de linhas do arquivo na versão verificada, ou 0 se não existe.
function evidenceViolations(addedLines, fileLines) {
  return addedLines.filter(({ text }) => {
    if (!DONE_RE.test(text)) return false;
    const refs = [...text.matchAll(REF_RE)];
    const valid = refs.filter(([, path, from, to]) => {
      const n = fileLines(path);
      return n > 0 && +from <= n && (!to || +to <= n);
    });
    return valid.length === 0 || valid.length !== refs.length;
  });
}

function missingSpecUpdate(changedFiles, optOutTexts) {
  const touchesCode = changedFiles.some((f) => CODE_RE.test(f));
  const touchesSpec = changedFiles.some((f) => SPEC_RE.test(f));
  return touchesCode && !touchesSpec && !optOutTexts.some((t) => OPT_OUT_RE.test(t));
}

module.exports = { evidenceViolations, missingSpecUpdate };

if (require.main === module) {
  const [base = 'origin/main', head = 'HEAD'] = process.argv.slice(2);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const changed = git('diff', '--name-only', `${base}...${head}`).split('\n').filter(Boolean);
  const added = [];
  let file = '';
  for (const line of git('diff', '-U0', `${base}...${head}`, '--', 'docs/tasks').split('\n')) {
    if (line.startsWith('+++ ')) file = line.slice(6);
    else if (line.startsWith('+')) added.push({ file, text: line.slice(1).replace(/\r$/, '') });
  }
  const fileLines = (path) => {
    try {
      return git('show', `${head}:${path}`).split('\n').length;
    } catch {
      return 0;
    }
  };
  const optOuts = [process.env.PR_BODY || '', git('log', '--format=%B', `${base}..${head}`)];

  const problems = evidenceViolations(added, fileLines).map(
    ({ file: f, text }) => `${f}: marcado como feito sem evidência \`arquivo:linha\` válida:\n    ${text.trim().slice(0, 160)}`,
  );
  if (missingSpecUpdate(changed, optOuts)) {
    problems.push(
      'Código mudou (src/, server.js ou index.html) sem atualizar .ai/specs/ nem docs/tasks/ (regra 09).\n' +
        '    Atualize a spec/blueprint, ou declare no PR/commit: "Spec: n/a — <motivo>".',
    );
  }
  if (problems.length) {
    console.error(`[spec-guard] ${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('[spec-guard] ok');
}
