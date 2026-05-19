const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Limpeza do Banco de Dados ---');

  try {
    // 1. Remover Agendamentos (que contêm as informações de clientes)
    const delAppointments = await prisma.appointment.deleteMany();
    console.log(`✅ ${delAppointments.count} agendamentos removidos.`);

    // 2. Remover Vendas de Produtos (Recebimentos)
    const delSales = await prisma.productSale.deleteMany();
    console.log(`✅ ${delSales.count} vendas de produtos removidas.`);

    // 3. Remover Despesas
    const delExpenses = await prisma.expense.deleteMany();
    console.log(`✅ ${delExpenses.count} despesas removidas.`);

    // Opcional: Manter barbeiros e serviços para o sistema continuar funcional
    // Mas remover barbeiros que foram marcados como deletados (lixeira)
    const delDeletedBarbers = await prisma.barber.deleteMany({
      where: { deletedAt: { not: null } }
    });
    console.log(`✅ ${delDeletedBarbers.count} barbeiros excluídos permanentemente.`);

    console.log('--- Limpeza concluída com sucesso! ---');
  } catch (err) {
    console.error('❌ Erro durante a limpeza:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
