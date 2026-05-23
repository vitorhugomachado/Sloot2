const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const apiRoutes = require('./routes/api');
const { getDefaultTenantSlug } = require('./lib/tenantHelpers');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(compression());
app.use(cors());
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

// Health Check for diagnostics
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gitSha: process.env.APP_GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null,
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../../dist');
  const indexHtml = path.resolve(distDir, 'index.html');

  const defaultSlug = getDefaultTenantSlug();

  app.use((req, res, next) => {
    if (req.path === '/cliente' || req.path.startsWith('/cliente/')) {
      const rest = req.path.slice('/cliente'.length) || '';
      return res.redirect(301, `/${defaultSlug}/cliente${rest}`);
    }
    if (req.path === '/barbeiros' || req.path.startsWith('/barbeiros/')) {
      const rest = req.path.slice('/barbeiros'.length) || '';
      return res.redirect(301, `/${defaultSlug}/barbeiros${rest}`);
    }
    if (req.path === '/barberone' || req.path.startsWith('/barberone/')) {
      return res.redirect(301, `/${defaultSlug}/cliente`);
    }
    next();
  });

  app.use(
    express.static(distDir, {
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
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
