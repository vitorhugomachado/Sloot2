const {
  normalizeSlug,
  isValidSlug,
  isReservedSlug,
} = require('./tenantHelpers');
const { validateStrongPassword } = require('./passwordPolicy');

function validateTenantSlug(slug, { excludeTenantId } = {}) {
  const normalized = normalizeSlug(slug);
  if (!isValidSlug(normalized)) {
    const err = new Error(
      'URL da barbearia inválida. Use letras minúsculas, números e hífens (ex.: minha-barbearia).',
    );
    err.status = 400;
    throw err;
  }
  if (isReservedSlug(normalized)) {
    const err = new Error('Esta URL está reservada pelo sistema. Escolha outro identificador.');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function validateShopName(shopName) {
  const name = String(shopName || '').trim();
  if (!name || name.length < 2) {
    const err = new Error('Nome da barbearia é obrigatório.');
    err.status = 400;
    throw err;
  }
  return name;
}

function validateManagerName(managerName) {
  const name = String(managerName || '').trim();
  if (!name) {
    const err = new Error('Nome do responsável é obrigatório.');
    err.status = 400;
    throw err;
  }
  return name;
}

function validateEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    const err = new Error('E-mail é obrigatório.');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function validateManagerPassword(password) {
  const pwd = String(password || '');
  const msg = validateStrongPassword(pwd);
  if (msg) {
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  return pwd;
}

module.exports = {
  validateTenantSlug,
  validateShopName,
  validateManagerName,
  validateEmail,
  validateManagerPassword,
  normalizeSlug,
};
