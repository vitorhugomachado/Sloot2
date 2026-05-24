const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('./app');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'produção' : 'desenvolvimento';
  console.log(`slooti — ${mode} — porta ${PORT} (HOST=${HOST}) — API multi-tenant (Tenant, sem BusinessInfo)`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`SPA + API na mesma origem; health: /health`);
  } else {
    console.log(`API em http://localhost:${PORT}/api (proxy do Vite em dev)`);
  }
});

// Prevent server from crashing on errors (like port already in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other Node process or set PORT in .env.`);
    console.error('Windows: netstat -ano | findstr ":3001" then taskkill /PID <pid> /F');
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Process-level error handling to prevent "clean exists" or silent failures
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

