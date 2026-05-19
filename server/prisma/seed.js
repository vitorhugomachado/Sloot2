const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/auth');
const prisma = new PrismaClient();

async function main() {
  // Clear existing data (optional, but good for seeding)
  await prisma.productSale.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.service.deleteMany();
  await prisma.product.deleteMany();
  await prisma.businessInfo.deleteMany();

  // --- BARBERS ---
  const pwd123 = await hashPassword('123');
  const pwdAdmin = await hashPassword('admin');

  await prisma.barber.createMany({
    data: [
      { name: 'Carlos Santos', email: 'carlos@barberpro.com', password: pwd123, role: 'Barbeiro', status: 'Ativo', permissions: ['dashboard', 'scheduler', 'clients'] },
      { name: 'André Lima', email: 'andre@barberpro.com', password: pwd123, role: 'Barbeiro', status: 'Ativo', permissions: ['scheduler', 'clients'] },
      { name: 'Rafael Costa', email: 'rafael@barberpro.com', password: pwd123, role: 'Barbeiro', status: 'Ativo', permissions: ['scheduler', 'clients'] },
    ]
  });

  await prisma.barber.create({
    data: { name: 'Super Admin', email: 'admin@admin.com', password: pwdAdmin, role: 'Gerente', status: 'Ativo', permissions: ['dashboard', 'scheduler', 'clients', 'finance', 'users', 'settings'] }
  });

  // --- SERVICES ---
  await prisma.service.createMany({
    data: [
      { name: 'Corte de Cabelo', price: 50, duration: '45 min' },
      { name: 'Barba Completa', price: 35, duration: '30 min' },
      { name: 'Corte + Barba', price: 75, duration: '1h 15 min' },
      { name: 'Limpeza de Pele', price: 40, duration: '30 min' },
    ]
  });

  // --- PRODUCTS ---
  await prisma.product.createMany({
    data: [
      { name: 'Pomada Modeladora', price: 45, cost: 20, stock: 15, category: 'Cabelo' },
      { name: 'Óleo para Barba', price: 35, cost: 15, stock: 8, category: 'Barba' },
      { name: 'Shampoo Mentolado', price: 55, cost: 25, stock: 12, category: 'Cabelo' },
      { name: 'Cerveja Artesanal', price: 15, cost: 8, stock: 24, category: 'Bebidas' },
    ]
  });

  // --- BUSINESS INFO ---
  await prisma.businessInfo.create({
    data: {
      id: 1,
      name: 'BarberPro',
      phone: '(11) 99999-9999',
      email: 'contato@barberpro.com',
      address: 'Av. Paulista, 1000 - Bela Vista, São Paulo'
    }
  });

  // --- APPOINTMENTS (Sample) ---
  const carlos = await prisma.barber.findFirst({ where: { name: 'Carlos Santos' } });
  await prisma.appointment.create({
    data: {
      customer: 'Vitor Machado',
      phone: '11999999999',
      service: 'Corte + Barba',
      barberId: carlos.id,
      date: '2024-04-02',
      time: '09:00',
      status: 'Em progresso',
      price: 75
    }
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
