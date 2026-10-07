#!/usr/bin/env node
// UserPromptSubmit — quando o pedido parece implementação, injeta no contexto o
// fluxo obrigatório do repo e o estado do git (branch, atraso em relação à main).
// Não bloqueia: orienta. Quem bloqueia são os git hooks (.githooks/) e o CI
// (.ai/scripts/spec-guard.js), que valem para qualquer ferramenta.
const { execFileSync } = require('child_process');

// ponytail: heurística por palavra-chave (PT/EN). Falso positivo custa só este
// lembrete; se incomodar, troque por algo melhor que palavra-chave.
const IMPLEMENT_RE =
  /\b(implement\w*|cri(?:e|ar|a)\b|adicion\w*|corrig\w*|corre[çc][ãa]o|consert\w*|refator\w*|alter(?:e|ar|a)\b|mud(?:e|ar|a)\b|ajust\w*|remov\w*|fazer|(?:fix|feat|add|build)\b)/i;
const SPEC_REF_RE = /\b(?:spec\w*|blueprint|issue|CA\d{2}|00[1-9])\b|#\d+/i;

function guide({ prompt, branch, behind }) {
  if (!IMPLEMENT_RE.test(prompt)) return '';
  const state = [];
  if (branch === 'main' || branch === 'master') {
    state.push(`Você está na ${branch}: crie a branch antes de editar (git switch -c feat/{slug} origin/main).`);
  }
  if (behind > 0) {
    state.push(`Esta branch está ${behind} commit(s) atrás de origin/main (desde o último fetch): integre antes de implementar.`);
  }
  if (!SPEC_REF_RE.test(prompt)) {
    state.push('O pedido não cita spec nem critério de aceite: pergunte qual é (ou rode /to-spec) antes de codar.');
  }
  return [
    '[workflow-guide] Fluxo obrigatório deste repo (docs/agents/playbook.md):',
    '1. O trabalho nasce de uma spec: .ai/specs/ + docs/tasks/{n}-{slug}/blueprint.md.',
    '2. Branch própria a partir da main atualizada; nunca commite nem dê push na main.',
    '3. Critério ou item só vira ✅/[x] com evidência `arquivo:linha` + teste.',
    '4. Mudou fluxo, regra ou escopo? Atualize a spec/blueprint no mesmo PR (regra 09).',
    '5. Entrega só por PR, citando a spec no corpo (ou "Spec: n/a — motivo").',
    '6. Pegou uma issue? Marque-a em andamento (assignee + label em-andamento + comentário com a branch) e não pegue issue já marcada (regra 10).',
    ...(state.length ? ['Estado agora:', ...state.map((s) => `- ${s}`)] : []),
  ].join('\n');
}

module.exports = { guide };

if (require.main === module) {
  const git = (...args) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  let input = '';
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    let prompt = '';
    try {
      prompt = JSON.parse(input)?.prompt || '';
    } catch {
      process.exit(0);
    }
    const text = guide({
      prompt,
      branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      behind: Number(git('rev-list', '--count', 'HEAD..origin/main')) || 0,
    });
    if (text) console.log(text);
    process.exit(0);
  });
}
