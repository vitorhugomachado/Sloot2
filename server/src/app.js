const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const apiRoutes = require('./routes/api');
const { resolveLegacyRedirect } = require('./lib/legacyRouteRedirects');
const { isSupabaseAuthConfigured } = require('./lib/supabaseAdmin');
const { isBookingMediaStorageConfigured } = require('./lib/bookingMediaStorage');
const { stripeWebhook } = require('./controllers/stripeWebhookController');
const prisma = require('./lib/prisma');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(compression());
app.use(cors());
// Stripe exige o corpo bruto para validar a assinatura; deve vir antes de express.json().
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
// Fotos em base64 no cadastro de barbeiro podem passar de 10mb; limite maior evita 500 genérico do body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Erros do body-parser (JSON grande / JSON inválido) — antes do 404 e do handler genérico
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413) {
    return res.status(413).json({
      message: 'Dados enviados são grandes demais.',
      details:
        'Remova ou troque por uma foto de perfil menor (imagens em alta resolução em base64 ficam muito pesadas) e tente novamente.',
    });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      message: 'JSON inválido no corpo da requisição.',
      details: err.message,
    });
  }
  next(err);
});

function getDbHostHint() {
  try {
    const raw = process.env.DATABASE_URL?.replace(/^postgres(ql)?:\/\//, 'http://');
    if (!raw) return null;
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

// Health Check for diagnostics
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gitSha: process.env.APP_GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null,
    dbConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    dbHost: getDbHostHint(),
    supabaseAuthConfigured: isSupabaseAuthConfigured(),
    bookingMediaStorageConfigured: isBookingMediaStorageConfigured(),
    runtime: process.env.RAILWAY_ENVIRONMENT ? 'railway' : 'node',
  });
});

// Readiness check: unlike /health, this verifies that the application can reach Postgres.
// Keep the timeout short so Railway never routes traffic to a hung instance.
app.get('/ready', async (req, res) => {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('database readiness timeout')), 2000);
    });
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return res.status(200).json({ status: 'ready', db: 'ok' });
  } catch (error) {
    console.error('[ready] database unavailable:', error.message);
    return res.status(503).json({ status: 'not_ready', db: 'unavailable' });
  } finally {
    if (timer) clearTimeout(timer);
  }
});

// Produção Railway/Docker: SERVE_SPA=true no Dockerfile
const serveSpa =
  process.env.SERVE_SPA === 'true' || process.env.NODE_ENV === 'production';

if (serveSpa) {
  const distDir = path.join(__dirname, '../../dist');
  const indexHtml = path.resolve(distDir, 'index.html');

  app.use((req, res, next) => {
    const dest = resolveLegacyRedirect(req.path);
    if (dest) return res.redirect(301, dest);
    next();
  });

  app.use(
    express.static(distDir, {
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
          return;
        }
        // Vídeos/imagens de marketing mudam no mesmo path — não marcar immutable
        if (/\.(mp4|webm|mov|png|jpe?g|webp|gif)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
      },
    }),
  );

  // Express 5: app.get('*') quebra path-to-regexp — fallback SPA via middleware
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml, (err) => (err ? next(err) : undefined));
  });
}

// 404 Handler - MUST be after routes
app.use((req, res) => {
  res.status(404).json({ 
    message: `Rota não encontrada: ${req.originalUrl}`,
    suggestion: "Verifique se o backend está rodando e se a URL no AppContext está correta." 
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (res.headersSent) return;
  res.status(500).json({
    message: 'Erro interno no servidor',
    details: err?.message || String(err),
  });
});

module.exports = app;
