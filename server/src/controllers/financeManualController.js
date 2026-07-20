const prisma = require('../lib/prisma');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');
const { normalizeBookingTime } = require('../utils/appointmentTime');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const includeBarber = { Barber: { select: { id: true, name: true } } };

function requireGerente(req, res) {
  if (req.user?.role !== 'Gerente') {
    res.status(403).json({ message: 'Apenas gestão pode registar lançamentos manuais.' });
    return false;
  }
  return true;
}

/**
 * Lançamento manual de atendimento já finalizado (receita de serviço).
 * Aceita datas passadas; não valida slot de agenda nem envia push.
 */
const createManualService = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;

    const {
      customer,
      phone,
      service,
      barberId,
      date,
      time,
      price,
      customerId,
    } = req.body || {};

    const normalizedBarberId = Number(barberId);
    const normalizedPrice = Number(price);
    const dateIso = String(date || '').slice(0, 10);
    const normalizedTime = normalizeBookingTime(time) || '12:00';

    if (
      !customer ||
      !String(customer).trim() ||
      !service ||
      !DATE_RE.test(dateIso) ||
      !Number.isFinite(normalizedBarberId) ||
      !Number.isFinite(normalizedPrice) ||
      normalizedPrice < 0
    ) {
      return res.status(400).json({
        message: 'Dados obrigatórios ausentes ou inválidos (cliente, serviço, profissional, data, valor).',
      });
    }

    const tenantId = tenantIdFromReq(req);

    const barber = await prisma.barber.findFirst({
      where: { id: normalizedBarberId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!barber) {
      return res.status(400).json({ message: 'Profissional inválido para esta barbearia.' });
    }

    const serviceRow = await prisma.service.findFirst({
      where: { tenantId, name: String(service) },
      select: { id: true, name: true },
    });
    if (!serviceRow) {
      return res.status(400).json({ message: 'Serviço inválido para esta barbearia.' });
    }

    let customer_id = null;
    if (customerId != null && customerId !== '') {
      const linked = Number(customerId);
      if (!Number.isFinite(linked) || linked <= 0) {
        return res.status(400).json({ message: 'Cliente inválido.' });
      }
      const cust = await prisma.customer.findFirst({
        where: { id: linked, tenantId },
        select: { id: true },
      });
      if (!cust) {
        return res.status(400).json({ message: 'Cliente não encontrado.' });
      }
      customer_id = cust.id;
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        customer: String(customer).trim(),
        phone: phone ? String(phone) : null,
        service: String(service),
        barberId: normalizedBarberId,
        date: dateIso,
        time: normalizedTime,
        status: 'Finalizado',
        price: normalizedPrice,
        payments: { paidAt: dateIso },
        customer_id,
      },
      include: includeBarber,
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error('createManualService error:', error);
    res.status(500).json({
      message: 'Erro ao registar atendimento manual',
      details: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    });
  }
};

/**
 * Lançamento manual de venda de produto (decrementa stock + ProductSale).
 */
const createManualProduct = async (req, res) => {
  try {
    if (!requireGerente(req, res)) return;

    const {
      productId,
      quantity,
      date,
      barberId,
      customerId,
      customerName,
    } = req.body || {};

    const normalizedProductId = Number(productId);
    const qty = Number(quantity);
    const dateIso = String(date || '').slice(0, 10);

    if (
      !Number.isFinite(normalizedProductId) ||
      normalizedProductId <= 0 ||
      !Number.isInteger(qty) ||
      qty <= 0 ||
      !DATE_RE.test(dateIso)
    ) {
      return res.status(400).json({
        message: 'Dados obrigatórios ausentes ou inválidos (produto, quantidade, data).',
      });
    }

    const tenantId = tenantIdFromReq(req);

    let resolvedBarberId = null;
    if (barberId != null && barberId !== '') {
      const bid = Number(barberId);
      if (!Number.isFinite(bid) || bid <= 0) {
        return res.status(400).json({ message: 'Profissional inválido.' });
      }
      const barber = await prisma.barber.findFirst({
        where: { id: bid, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!barber) {
        return res.status(400).json({ message: 'Profissional inválido para esta barbearia.' });
      }
      resolvedBarberId = barber.id;
    }

    let resolvedCustomerId = null;
    let resolvedCustomerName =
      typeof customerName === 'string' && customerName.trim() ? customerName.trim() : null;

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

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: normalizedProductId, tenantId },
      });
      if (!product) {
        const err = new Error('Produto não encontrado.');
        err.status = 404;
        throw err;
      }
      if (product.stock < qty) {
        const err = new Error('Estoque insuficiente para esta venda.');
        err.status = 400;
        throw err;
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: product.stock - qty },
      });

      const sale = await tx.productSale.create({
        data: {
          tenantId,
          productId: product.id,
          productName: product.name,
          price: product.price,
          cost: product.cost,
          quantity: qty,
          date: dateIso,
          barberId: resolvedBarberId,
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
        },
        include: {
          Barber: { select: { id: true, name: true } },
          Customer: { select: { id: true, name: true } },
        },
      });

      return { sale, product: updatedProduct };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('createManualProduct error:', error);
    res.status(500).json({
      message: 'Erro ao registar venda manual',
      details: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    });
  }
};

module.exports = {
  createManualService,
  createManualProduct,
};
