const bcrypt = require('bcryptjs');

const hashes = {
  'admin@admin.com': '$2b$10$D.eJyE4Z1EhifMko8FVxSOLXf./QSDLFqwDWQICrWPt6C2zQF4qzC',
  'carlos@carlos.com': '$2b$10$dStA6FaFelKopNb4t9bfMe2Hk43McMrpxFQlNQML2DsAD3zos6N5O'
};

async function check() {
  const isAdminMatch = await bcrypt.compare('admin', hashes['admin@admin.com']);
  const isCarlosMatch = await bcrypt.compare('123', hashes['carlos@carlos.com']);
  
  console.log(`admin@admin.com / admin: ${isAdminMatch}`);
  console.log(`carlos@carlos.com / 123: ${isCarlosMatch}`);
}

check();
