/**
 * Cria ou atualiza o usuário PlatformAdmin (painel /admin).
 * Uso: PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npm run create:platform-admin
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/auth');
const { validateStrongPassword } = require('../src/lib/passwordPolicy');

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
  const password = String(process.env.PLATFORM_ADMIN_PASSWORD || process.argv[3] || '');

  if (!email || !password) {
    console.error('Informe PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD no .env ou como argumentos.');
    console.error('Ex.: npm run create:platform-admin -- admin@sloot.com MinhaSenhaSegura');
    process.exit(1);
  }

  const pwdError = validateStrongPassword(password);
  if (pwdError) {
    console.error(pwdError);
    process.exit(1);
  }

  const hashed = await hashPassword(password);
  const existing = await prisma.platformAdmin.findUnique({ where: { email } });

  if (existing) {
    await prisma.platformAdmin.update({
      where: { email },
      data: { password: hashed, status: 'active', name: existing.name || 'Admin Sloot' },
    });
    console.log(`PlatformAdmin atualizado: ${email}`);
  } else {
    await prisma.platformAdmin.create({
      data: {
        name: 'Admin Sloot',
        email,
        password: hashed,
        status: 'active',
      },
    });
    console.log(`PlatformAdmin criado: ${email}`);
  }

  console.log('Acesse o painel em /admin no seu domínio.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
