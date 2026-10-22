// cleanup2.cjs — supprime les helpers temporaires à la racine du projet.
const fs = require('fs');
const path = require('path');
// Racine réelle du projet (fonctionne quel que soit le dossier d'installation,
// y compris « mar-ci center\taskpilse2 » — plus de chemin absolu codé en dur).
const h = __dirname;
const files = [
  'cleanup.cjs', 'do-cleanup.bat', 'verify.bat', 'tsc-check.cjs',
  'tsc-check.bat', 'tsc-result.txt',
];
for (const f of files) {
  const full = path.join(h, f);
  try { fs.unlinkSync(full); console.log('[del] ' + f); } catch (e) { console.log('[skip] ' + f); }
}
console.log('[cleanup2] terminé');