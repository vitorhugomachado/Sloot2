const { verifyToken } = require('../utils/auth');

function platformAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }
  const decoded = verifyToken(authHeader.split(' ')[1]);
  if (!decoded || decoded.type !== 'platform') {
    return res.status(403).json({ message: 'Acesso restrito à plataforma.' });
  }
  req.user = decoded;
  next();
}

module.exports = platformAuthMiddleware;
