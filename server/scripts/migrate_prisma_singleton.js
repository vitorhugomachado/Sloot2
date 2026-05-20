const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith('.js')) continue;
    if (p.endsWith(`${path.sep}lib${path.sep}prisma.js`)) continue;

    let text = fs.readFileSync(p, 'utf8');
    if (!text.includes('new PrismaClient')) continue;

    const rel = path.relative(path.dirname(p), path.join(__dirname, '..', 'src', 'lib', 'prisma.js')).replace(/\\/g, '/');
    text = text.replace(/const\s*\{\s*PrismaClient\s*\}\s*=\s*require\(['"]@prisma\/client['"]\);\s*\n?/g, '');
    text = text.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\);\s*\n?/g, '');
    const req = `const prisma = require('${rel}');\n`;
    if (!text.includes(req.trim())) {
      text = req + text;
    }
    fs.writeFileSync(p, text);
    console.log('updated', p);
  }
}

walk(path.join(__dirname, '..', 'src'));
