const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getExpenses = async (req, res) => {
  try {
    if (req.user?.role !== 'Gerente') {
      return res.json([]);
    }
    const expenses = await prisma.expense.findMany();
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
        description,
        amount: parseFloat(amount),
        date,
        category: category || 'Outros'
      }
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
    const { description, amount, date, category } = req.body;
    const updated = await prisma.expense.update({
      where: { id: parseInt(id) },
      data: {
        description,
        amount: parseFloat(amount),
        date,
        category
      }
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
    await prisma.expense.delete({
      where: { id: parseInt(id) }
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
  deleteExpense
};
