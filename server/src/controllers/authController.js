const prisma = require('../lib/prisma.js');
const { comparePassword, generateToken } = require('../utils/auth');
const { tenantIdFromReq } = require('../lib/tenantHelpers');

const login = async (req, res) => {
  const rawEmail = req.body?.email;
  const password = req.body?.password;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
  const tenantId = tenantIdFromReq(req);

  try {
    const barber = await prisma.barber.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });

    if (!barber) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos' });
    }

    const isMatch = await comparePassword(password, barber.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'E-mail ou senha incorretos' });
    }

    if (barber.status === 'Suspenso') {
      return res.status(403).json({ message: 'Sua conta está suspensa pelo administrador' });
    }

    const token = generateToken({
      id: barber.id,
      role: barber.role,
      tenantId: barber.tenantId,
    });

    const { password: _, ...barberData } = barber;

    res.json({ token, user: barberData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
};

const getMe = async (req, res) => {
  try {
    const barber = await prisma.barber.findFirst({
      where: { id: req.user.id, tenantId: req.user.tenantId },
    });
    if (!barber) return res.status(404).json({ message: 'Usuário não encontrado' });
    const { password: _, ...barberData } = barber;
    res.json(barberData);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
};

module.exports = { login, getMe };
