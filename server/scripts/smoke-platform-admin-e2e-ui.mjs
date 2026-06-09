/**
 * E2E UI: criar e editar fluxos do painel /admin (Playwright).
 * Uso: node scripts/smoke-platform-admin-e2e-ui.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@sloot.com';
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'SenhaSegura1';

const checks = [];
const ts = Date.now();
const slug = `e2e-admin-${ts}`;
const shopName = `E2E Admin ${ts}`;

function pass(label) {
  checks.push({ label, ok: true });
  console.log(`OK ${label}`);
}

function fail(label, err) {
  checks.push({ label, ok: false, err: String(err) });
  console.error(`FAIL ${label}:`, err);
}

async function login(page) {
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[autocomplete="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(
    () => Boolean(localStorage.getItem('sloot_platform_token')),
    null,
    { timeout: 15000 },
  );
  await page.waitForSelector('.platform-kpi-row, .platform-table, h1', { timeout: 15000 });
}

async function waitToast(page) {
  await page.waitForSelector('.platform-toast', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await login(page);
    pass('login');

    await page.goto(`${BASE}/admin/barbearias`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Barbearias")', { timeout: 15000 });
    pass('nav barbearias');

    await page.getByRole('button', { name: /Nova barbearia/i }).click();
    await page.getByPlaceholder('Nome da barbearia *').fill(shopName);
    await page.getByPlaceholder('URL (slug) *').fill(slug);
    await page.getByPlaceholder('Nome do gestor *').fill('Gestor E2E');
    await page.getByPlaceholder('E-mail do gestor *').fill(`gestor-${ts}@test.local`);
    const pwdFields = page.locator('input[autocomplete="new-password"]');
    await pwdFields.nth(0).fill('SenhaSegura1');
    await pwdFields.nth(1).fill('SenhaSegura1');
    await page.getByRole('button', { name: /Criar barbearia/i }).click();
    await page.waitForSelector('.platform-success-banner', { timeout: 15000 });
    pass('criar barbearia');

    await page.getByRole('link', { name: shopName }).first().click();
    await page.waitForURL(/\/admin\/barbearias\/\d+\/resumo/);
    const tenantId = page.url().match(/\/barbearias\/(\d+)/)?.[1];
    if (!tenantId) throw new Error('tenant id not found in URL');
    pass('abrir tenant resumo');

    // Resumo — contacto
    const contactPanel = page.locator('.dash-panel:has-text("Contacto")');
    await contactPanel.locator('input[type="email"]').fill(`contacto-${ts}@test.local`);
    await contactPanel.locator('input').nth(1).fill('(11) 98888-7777');
    await contactPanel.locator('input').nth(2).fill('Av. E2E 100');
    await contactPanel.locator('input').nth(3).fill(`Tagline E2E ${ts}`);
    await contactPanel.getByRole('button', { name: /Salvar contacto/i }).click();
    await waitToast(page);
    pass('editar contacto resumo');

    // Módulos empresa (resumo)
    const modPanel = page.locator('.dash-panel:has-text("Módulos da barbearia")').first();
    await modPanel.getByRole('button', { name: 'Estoque' }).click();
    await modPanel.getByRole('button', { name: /Salvar módulos/i }).click();
    await waitToast(page);
    await modPanel.getByRole('button', { name: 'Estoque' }).click();
    await modPanel.getByRole('button', { name: /Salvar módulos/i }).click();
    await waitToast(page);
    pass('editar módulos empresa');

    // Equipe
    await page.goto(`${BASE}/admin/barbearias/${tenantId}/equipe`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Novo$/i }).click();
    const createBarberForm = page.locator('.dash-panel:has-text("Novo profissional")');
    await createBarberForm.locator('input').nth(0).fill(`Barbeiro E2E ${ts}`);
    await createBarberForm.locator('input[type="email"]').fill(`barbeiro-${ts}@test.local`);
    await createBarberForm.getByRole('button', { name: /^Criar$/i }).click();
    await waitToast(page);
    pass('criar barbeiro');

    await page.getByRole('cell', { name: `Barbeiro E2E ${ts}` }).click();
    const editBarberPanel = page.locator('.dash-panel:has-text("Editar —")');
    await editBarberPanel.locator('input').first().fill(`Barbeiro Edit ${ts}`);
    await editBarberPanel.getByRole('button', { name: /Salvar dados/i }).click();
    await waitToast(page);
    pass('editar barbeiro');

    await page.getByRole('button', { name: 'Agendamentos' }).click();
    await page.getByRole('button', { name: /Salvar permissões/i }).click();
    await waitToast(page);
    pass('editar permissões barbeiro');

    // Estoque
    await page.goto(`${BASE}/admin/barbearias/${tenantId}/estoque`, { waitUntil: 'networkidle' });
    const addProductForm = page.locator('.platform-form--inline').first();
    await addProductForm.locator('input').nth(0).fill(`Produto E2E ${ts}`);
    await addProductForm.locator('input[type="number"]').nth(0).fill('25');
    await addProductForm.getByRole('button', { name: /Adicionar produto/i }).click();
    await waitToast(page);
    pass('criar produto');

    await page.getByRole('cell', { name: `Produto E2E ${ts}` }).click();
    const editProductPanel = page.locator('.dash-panel:has-text("Editar produto")');
    await editProductPanel.locator('input').first().fill(`Produto Edit ${ts}`);
    await editProductPanel.getByRole('button', { name: /Salvar produto/i }).click();
    await waitToast(page);
    pass('editar produto');

    // Configuração
    await page.goto(`${BASE}/admin/barbearias/${tenantId}/configuracao`, { waitUntil: 'networkidle' });
    const brandPanel = page.locator('.dash-panel:has-text("Branding")');
    await brandPanel.locator('label:has-text("Tagline") input').fill(`Brand Tag ${ts}`);
    await brandPanel.getByRole('button', { name: /Salvar branding/i }).click();
    await waitToast(page);
    pass('editar branding');

    const addServiceForm = page.locator('.platform-form--inline').first();
    await addServiceForm.locator('input').nth(0).fill(`Serviço E2E ${ts}`);
    await addServiceForm.locator('input[type="number"]').first().fill('45');
    await addServiceForm.getByRole('button', { name: /^Adicionar$/i }).click();
    await waitToast(page);
    pass('criar serviço');

    await page.getByRole('cell', { name: `Serviço E2E ${ts}` }).click();
    await page.locator('form:has-text("A editar") input').first().fill(`Serviço Edit ${ts}`);
    await page.getByRole('button', { name: /Salvar serviço/i }).click();
    await waitToast(page);
    pass('editar serviço');

    const adminPanel = page.locator('.dash-panel:has-text("Dados administrativos")');
    await adminPanel.locator('input').first().fill(shopName);
    await adminPanel.getByRole('button', { name: /Salvar barbearia/i }).click();
    await waitToast(page);
    pass('editar dados administrativos');

    const managerPanel = page.locator('.dash-panel:has-text("Gerente principal")');
    await managerPanel.locator('input').first().fill(`Gestor Edit ${ts}`);
    await managerPanel.getByRole('button', { name: /Salvar gerente/i }).click();
    await waitToast(page);
    pass('editar gerente');

    // Admins plataforma
    await page.goto(`${BASE}/admin/admins`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Novo admin/i }).click();
    const adminModal = page.locator('.platform-modal');
    await adminModal.locator('input').nth(0).fill(`Admin E2E ${ts}`);
    await adminModal.locator('input[type="email"]').fill(`admin-e2e-${ts}@test.local`);
    await adminModal.locator('input[type="password"]').fill('SenhaSegura1');
    await adminModal.getByRole('button', { name: /^Salvar$/i }).click();
    await waitToast(page);
    pass('criar admin plataforma');

    pass(`tenant criado: /${slug} (id ${tenantId})`);
  } catch (err) {
    fail('e2e flow', err.message || err);
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.error('\nE2E UI failures:', failed.length);
    failed.forEach((f) => console.error(' -', f.label, f.err));
    process.exit(1);
  }
  console.log(`\nAll ${checks.length} E2E UI checks passed`);
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
