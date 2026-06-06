const fs = require('fs');
const path = require('path');

const base = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-VITOR-E-STEFANI-Desktop-slooti060626-Sloot2-main',
);
const data = JSON.parse(fs.readFileSync(path.join(base, 'assets/step-images-data.json'), 'utf8'));
const images = {
  setup: data['step-setup-illus'],
  share: data['step-share-illus'],
  calendar: data['step-calendar-illus'],
};

const canvasPath = path.join(base, 'canvases/como-funciona-steps.canvas.tsx');
let canvas = fs.readFileSync(canvasPath, 'utf8');

const start = canvas.indexOf('function SetupIcon');
const end = canvas.indexOf('function StepCard');
const imagesBlock = `const STEP_IMAGES = ${JSON.stringify(images)} as const;\n\n`;
canvas = canvas.slice(0, start) + imagesBlock + canvas.slice(end);

canvas = canvas.replace(
  '<StepIcon type={icon} accent={accentText} />',
  `<img
          src={STEP_IMAGES[icon]}
          alt=""
          width={108}
          height={108}
          style={{ display: "block", width: 108, height: 108, objectFit: "contain", mixBlendMode: "multiply" }}
        />`,
);

canvas = canvas.replace(
  'Preview dos cards da landing · referência visual da seção lt-steps · tokens do canvas (landing usa laranja #ff6a00)',
  'Preview dos cards da landing · ilustrações geradas por card · tokens do canvas para cores',
);

fs.writeFileSync(canvasPath, canvas);
console.log('Updated canvas:', canvas.length, 'bytes');
