const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const customers = await prisma.customer.findMany();
    console.log("Customer table exists. Count:", customers.length);
    process.exit(0);
  } catch (e) {
    console.error("Error checking customer table:", e.message);
    process.exit(1);
  }
}

check();
