/**
 * Falha o arranque se o código em disco ainda referencia BusinessInfo (deploy antigo).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const FORBIDDEN = 'businessInfo.findUnique';
const files = [
  path.join(ROOT, 'controllers', 'businessController.js'),
  path.join(ROOT, 'controllers', 'publicBootstrapController.js'),
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(FORBIDDEN)) {
    console.error(`[deploy] Código desatualizado em ${file} — ainda usa ${FORBIDDEN}.`);
    console.error('[deploy] Faça redeploy do branch main mais recente no Railway.');
    process.exit(1);
  }
}

console.log('[deploy] OK — controllers multi-tenant (sem BusinessInfo).');
