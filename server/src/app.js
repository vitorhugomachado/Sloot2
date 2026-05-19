const express = require('express');
const path = require('path');
const cors = require('cors');
const authMiddleware = require('./middlewares/authMiddleware');
const { getPeriodClosings, createPeriodClosing } = require('./controllers/periodClosingController');
const apiRoutes = require('./routes/api');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors());
// Fotos em base64 no cadastro de barbeiro podem passar de 10mb; limite maior evita 500 genérico do body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Fechamento por período: registar antes do router `/api` para garantir match (evita 404 se o stack do router mudar).
app.get('/api/period-closings', authMiddleware, getPeriodClosings);
app.post('/api/period-closings', authMiddleware, createPeriodClosing);

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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist')));
  
  app.get('*', (req, res, next) => {
    // If it's an API route that reached here, let it fall through to 404
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.resolve(__dirname, '../../', 'dist', 'index.html'));
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
