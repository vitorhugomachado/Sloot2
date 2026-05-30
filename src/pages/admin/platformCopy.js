export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard não disponível'));
}

export async function copyWithToast(text, setToast) {
  try {
    await copyText(text);
    setToast('Link copiado!');
  } catch {
    setToast('Não foi possível copiar.');
  }
}
