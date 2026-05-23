const prisma = require('../lib/prisma.js');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');

const getProducts = async (req, res) => {
  const products = await prisma.product.findMany({ where: tenantWhere(req) });
  res.json(products);
};

const createProduct = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de produtos.' });
    }
    const product = await prisma.product.create({
      data: { ...req.body, tenantId: tenantIdFromReq(req) },
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar produto' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de produtos.' });
    }
    const { id } = req.params;
    const existing = await prisma.product.findFirst({
      where: { id: Number(id), ...tenantWhere(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
    await prisma.product.delete({ where: { id: Number(id) } });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir produto' });
  }
};

const updateProduct = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o catálogo de produtos.' });
  }
  const { id } = req.params;
  const existing = await prisma.product.findFirst({
    where: { id: Number(id), ...tenantWhere(req) },
  });
  if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
  const product = await prisma.product.update({ where: { id: Number(id) }, data: req.body });
  res.json(product);
};

const MAX_STOCK_DELTA = 1_000_000;

const adjustProductStock = async (req, res) => {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas gestão pode alterar o estoque.' });
  }
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'ID de produto inválido.' });
  }
  const delta = Number(req.body?.delta);
  if (!Number.isInteger(delta) || delta <= 0) {
    return res.status(400).json({
      message: 'Informe delta: número inteiro maior que zero (quantidade a adicionar ao estoque).',
    });
  }
  if (delta > MAX_STOCK_DELTA) {
    return res.status(400).json({ message: `A quantidade não pode exceder ${MAX_STOCK_DELTA}.` });
  }
  try {
    const existing = await prisma.product.findFirst({
      where: { id, ...tenantWhere(req) },
    });
    if (!existing) return res.status(404).json({ message: 'Produto não encontrado.' });
    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: delta } },
    });
    return res.json(product);
  } catch (e) {
    console.error('adjustProductStock', e);
    return res.status(500).json({ message: 'Erro ao actualizar o estoque.' });
  }
};

const getSales = async (req, res) => {
  try {
    const { barberId } = req.query;
    const where = { ...tenantWhere(req) };

    if (req.user.role !== 'Gerente') {
      where.barberId = req.user.id;
    } else if (barberId === 'null' || barberId === 'barbershop') {
      where.barberId = null;
    } else if (barberId) {
      where.barberId = Number(barberId);
    }

    const sales = await prisma.productSale.findMany({
      where,
      include: {
        Barber: { select: { id: true, name: true } },
        Customer: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar vendas' });
  }
};

const createSale = async (req, res) => {
  try {
    const { barberId, customerId, customerName, ...rest } = req.body;
    const tenantId = tenantIdFromReq(req);
    const isGerente = req.user?.role === 'Gerente';
    const resolvedBarberId = isGerente
      ? (barberId ? Number(barberId) : null)
      : Number(req.user.id);

    let resolvedCustomerId = null;
    let resolvedCustomerName = typeof customerName === 'string' && customerName.trim()
      ? customerName.trim()
      : null;

    if (customerId != null && customerId !== '') {
      const cid = Number(customerId);
      if (!Number.isFinite(cid)) {
        return res.status(400).json({ message: 'Cliente inválido.' });
      }
      const customer = await prisma.customer.findFirst({
        where: { id: cid, tenantId },
        select: { id: true, name: true },
      });
      if (!customer) {
        return res.status(400).json({ message: 'Cliente não encontrado.' });
      }
      resolvedCustomerId = customer.id;
      if (!resolvedCustomerName) resolvedCustomerName = customer.name;
    }

    const data = {
      ...rest,
      tenantId,
      barberId: resolvedBarberId,
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
    };
    const sale = await prisma.productSale.create({
      data,
      include: {
        Barber: { select: { id: true, name: true } },
        Customer: { select: { id: true, name: true } },
      },
    });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao registrar venda' });
  }
};

module.exports = {
  getProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  adjustProductStock,
  getSales,
  createSale,
};
