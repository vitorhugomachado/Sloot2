/** Reduz data URL (evita imagens gigantes no Postgres). */
export async function compressImageFileToDataUrl(file, maxEdge = 1400, quality = 0.86) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro'));
    reader.readAsDataURL(file);
  });
  if (typeof rawDataUrl !== 'string' || !rawDataUrl.startsWith('data:image')) {
    return rawDataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

/** Converte uma foto para JPEG pequeno antes do upload binário. */
export async function compressImageFileToJpegBlob(file, maxEdge = 1600, quality = 0.85) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      img.src = objectUrl;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('Não foi possível comprimir a imagem.');
    if (blob.size > 2 * 1024 * 1024) throw new Error('A imagem continua maior que 2 MB após a compressão.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
