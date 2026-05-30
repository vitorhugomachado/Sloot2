function validateStrongPassword(password) {
  const pwd = String(password || '');
  if (pwd.length < 8) {
    return 'Senha deve ter pelo menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Senha deve conter pelo menos uma letra maiúscula.';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Senha deve conter pelo menos uma letra minúscula.';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Senha deve conter pelo menos um número.';
  }
  return null;
}

module.exports = { validateStrongPassword };
