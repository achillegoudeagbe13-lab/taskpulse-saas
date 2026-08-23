// cleanup2.cjs
const fs = require('fs');
const path = require('path');
const h = 'C:/Users/ADM/Desktop/taskpilse2';
const files = [
  'cleanup.cjs', 'do-cleanup.bat', 'verify.bat', 'tsc-check.cjs',
  'tsc-check.bat', 'tsc-result.txt',
];
for (const f of files) {
  const full = path.join(h, f);
  try { fs.unlinkSync(full); console.log('[del] ' + f); } catch (e) { console.log('[skip] ' + f); }
}
console.log('[cleanup2] terminé');