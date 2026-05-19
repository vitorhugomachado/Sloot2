// Entry point — load env before any module that touches Prisma
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

require('./src/server');
