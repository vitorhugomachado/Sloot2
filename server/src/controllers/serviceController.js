const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    res.json(services);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ message: 'Erro ao buscar serviços' });
  }
};

const createService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const service = await prisma.service.create({ data: req.body });
  res.json(service);
};

const updateService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const { id } = req.params;
  const service = await prisma.service.update({ where: { id: Number(id) }, data: req.body });
  res.json(service);
};

const deleteService = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de serviços.' });
  }
  const { id } = req.params;
  await prisma.service.delete({ where: { id: Number(id) } });
  res.sendStatus(204);
};

module.exports = { getServices, createService, updateService, deleteService };

