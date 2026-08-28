const { execSync } = require('child_process');
const fs = require('fs');
let out = '';
function run(label, cmd) {
  try {
    const r = execSync(cmd, { encoding: 'utf8', cwd: 'c:/Users/ADM/Desktop/taskpilse2', timeout: 60000 });
    out += `== ${label} ==\n${r || '(empty)'}\n`;
  } catch (e) {
    out += `== ${label} == ERROR: ${(e.message || String(e)).slice(0, 500)}\n${e.stdout ? e.stdout.slice(0, 1000) : ''}\n`;
  }
}
run('STATUS', 'git status --short');
run('LOG', 'git log -3 --oneline');
run('BRANCH', 'git status -sb');
fs.writeFileSync('c:/Users/ADM/Desktop/taskpilse2/.gstate.txt', out, 'utf8');
