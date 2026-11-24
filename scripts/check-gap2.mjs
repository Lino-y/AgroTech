import { spawnSync } from 'node:child_process';
const run = spawnSync(process.execPath, ['--test', 'tests/coverage-gap.test.js'], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
const idx = (run.stdout + run.stderr).indexOf('failing tests:');

console.log((run.stdout + run.stderr).slice(idx, idx + 6000));
