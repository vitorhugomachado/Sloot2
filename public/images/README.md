# Imagem de fundo do login

O fundo do login staff/admin usa `public/fundo.webp` (servido em `/fundo.webp`).

Fonte editável: `src/assets/customer-login-bg.png` — após trocar, regenere o WebP:

```bash
npx sharp-cli -i src/assets/customer-login-bg.png -o public/fundo.webp -f webp
```
