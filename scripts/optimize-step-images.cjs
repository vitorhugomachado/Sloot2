const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.join(__dirname, '..');
const illusDir = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-VITOR-E-STEFANI-Desktop-slooti060626-Sloot2-main/assets',
);
const landingAssets = path.join(projectRoot, 'src/pages/landing-teste/assets');
const canvasPath = path.join(
  process.env.USERPROFILE,
  '.cursor/projects/c-Users-VITOR-E-STEFANI-Desktop-slooti060626-Sloot2-main/canvases/como-funciona-steps.canvas.tsx',
);

const STEPS = ['setup', 'share', 'calendar'];
const CARD_WIDTH = 220;
const CARD_HEIGHT = 150;

function resizeToCard(input) {
  return sharp(input).resize(CARD_WIDTH, CARD_HEIGHT, {
    fit: 'cover',
    position: 'centre',
  });
}

async function optimizeForLanding(name) {
  const input = path.join(illusDir, `step-${name}-illus.png`);
  const output = path.join(landingAssets, `step-${name}.png`);
  await resizeToCard(input)
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toFile(output);
  const meta = await sharp(output).metadata();
  const stat = fs.statSync(output);
  console.log(`landing ${name}: ${meta.width}x${meta.height} ${Math.round(stat.size / 1024)}KB`);
}

async function buildCanvasImages() {
  const images = {};
  for (const name of STEPS) {
    const input = path.join(illusDir, `step-${name}-illus.png`);
    const buf = await resizeToCard(input)
      .png({ compressionLevel: 8, adaptiveFiltering: true })
      .toBuffer();
    images[name] = `data:image/png;base64,${buf.toString('base64')}`;
    console.log(`canvas ${name}: ${Math.round(buf.length / 1024)}KB base64 payload`);
  }
  return images;
}

function updateCanvas(images) {
  let canvas = fs.readFileSync(canvasPath, 'utf8');
  const start = canvas.indexOf('const STEP_IMAGES = ');
  if (start === -1) {
    throw new Error('STEP_IMAGES block not found in canvas');
  }
  const braceStart = canvas.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < canvas.length; i += 1) {
    if (canvas[i] === '{') depth += 1;
    else if (canvas[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) {
    throw new Error('STEP_IMAGES block end not found in canvas');
  }
  canvas =
    canvas.slice(0, start) +
    `const STEP_IMAGES = ${JSON.stringify(images)}` +
    canvas.slice(end);
  fs.writeFileSync(canvasPath, canvas);
  console.log('canvas updated:', canvas.length, 'bytes');
}

async function main() {
  for (const name of STEPS) {
    await optimizeForLanding(name);
  }
  const images = await buildCanvasImages();
  updateCanvas(images);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
