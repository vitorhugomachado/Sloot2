/**
 * Handler Express partilhado pelas funções em /api (Vercel).
 */
const path = require('path');

if (!process.env.VERCEL) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
  } catch {
    /* opcional em dev local */
  }
}

module.exports = require('../server/src/app');
