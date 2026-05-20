const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/auth');
const prisma = new PrismaClient();

async function main() {
  await prisma.productSale.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.barberScheduleBlock.deleteMany().catch(() => {});
  await prisma.workingShifts.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.product.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.monthClosing.deleteMany();
  await prisma.financialPeriodClosing.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      slug: 'demo-barbearia',
      name: 'Demo BarberPro',
      phone: '(11) 99999-9999',
      email: 'contato@demo.com',
      address: 'Av. Paulista, 1000 - São Paulo',
    },
  });

  const pwd123 = await hashPassword('123');
  const pwdAdmin = await hashPassword('admin');

  await prisma.barber.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: 'Carlos Santos',
        email: 'carlos@barberpro.com',
        password: pwd123,
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['dashboard', 'scheduler', 'clients'],
      },
      {
        tenantId: tenant.id,
        name: 'André Lima',
        email: 'andre@barberpro.com',
        password: pwd123,
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['scheduler', 'clients'],
      },
      {
        tenantId: tenant.id,
        name: 'Rafael Costa',
        email: 'rafael@barberpro.com',
        password: pwd123,
        role: 'Barbeiro',
        status: 'Ativo',
        permissions: ['scheduler', 'clients'],
      },
    ],
  });

  await prisma.barber.create({
    data: {
      tenantId: tenant.id,
      name: 'Super Admin',
      email: 'admin@admin.com',
      password: pwdAdmin,
      role: 'Gerente',
      status: 'Ativo',
      permissions: ['dashboard', 'scheduler', 'clients', 'finance', 'users', 'settings', 'inventory'],
    },
  });

  await prisma.service.createMany({
    data: [
      { tenantId: tenant.id, name: 'Corte de Cabelo', price: 50, duration: '45 min' },
      { tenantId: tenant.id, name: 'Barba Completa', price: 35, duration: '30 min' },
      { tenantId: tenant.id, name: 'Corte + Barba', price: 75, duration: '1h 15 min' },
      { tenantId: tenant.id, name: 'Limpeza de Pele', price: 40, duration: '30 min' },
    ],
  });

  await prisma.product.createMany({
    data: [
      { tenantId: tenant.id, name: 'Pomada Modeladora', price: 45, cost: 20, stock: 15, category: 'Cabelo' },
      { tenantId: tenant.id, name: 'Óleo para Barba', price: 35, cost: 15, stock: 8, category: 'Barba' },
      { tenantId: tenant.id, name: 'Shampoo Mentolado', price: 55, cost: 25, stock: 12, category: 'Cabelo' },
      { tenantId: tenant.id, name: 'Cerveja Artesanal', price: 15, cost: 8, stock: 24, category: 'Bebidas' },
    ],
  });

  const carlos = await prisma.barber.findFirst({
    where: { tenantId: tenant.id, name: 'Carlos Santos' },
  });
  await prisma.appointment.create({
    data: {
      tenantId: tenant.id,
      customer: 'Vitor Machado',
      phone: '11999999999',
      service: 'Corte + Barba',
      barberId: carlos.id,
      date: '2024-04-02',
      time: '09:00',
      status: 'Em progresso',
      price: 75,
    },
  });

  console.log('Database seeded (tenant: demo-barbearia)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
