/**
 * Vercel serverless entry (CommonJS — raiz do projeto é "type": "module").
 */
const path = require('path');
const serverless = require('serverless-http');

if (!process.env.VERCEL) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
  } catch {
    /* dotenv opcional em dev local */
  }
}

const app = require('../server/src/app');

module.exports = serverless(app);
