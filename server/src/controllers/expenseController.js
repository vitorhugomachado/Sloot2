const prisma = require('../lib/prisma.js');
const { tenantWhere, tenantIdFromReq } = require('../lib/tenantHelpers');

const getExpenses = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.json([]);
    }
    const expenses = await prisma.expense.findMany({ where: tenantWhere(req) });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar despesas' });
  }
};

const createExpense = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ error: 'Apenas gestão pode registar despesas.' });
    }
    const { description, amount, date, category } = req.body;
    const newExpense = await prisma.expense.create({
      data: {
        tenantId: tenantIdFromReq(req),
        description,
        amount: parseFloat(amount),
        date,
        category: category || 'Outros',
      },
    });
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar despesa' });
  }
};

const updateExpense = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ error: 'Apenas gestão pode editar despesas.' });
    }
    const { id } = req.params;
    const existing = await prisma.expense.findFirst({
      where: { id: parseInt(id, 10), ...tenantWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada.' });
    const updated = await prisma.expense.update({
      where: { id: parseInt(id, 10) },
      data: {
        description: req.body.description,
        amount: parseFloat(req.body.amount),
        date: req.body.date,
        category: req.body.category,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.status(403).json({ error: 'Apenas gestão pode excluir despesas.' });
    }
    const { id } = req.params;
    const existing = await prisma.expense.findFirst({
      where: { id: parseInt(id, 10), ...tenantWhere(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada.' });
    await prisma.expense.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir despesa' });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};
