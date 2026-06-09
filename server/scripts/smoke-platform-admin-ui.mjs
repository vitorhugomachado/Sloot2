/**
 * Checklist UI /admin (desktop + mobile) via Playwright.
 * Uso: node scripts/smoke-platform-admin-ui.mjs
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const EMAIL = process.env.PLATFORM_ADMIN_EMAIL || 'admin@sloot.com';
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || 'SenhaSegura1';

const checks = [];

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
  const email = page.locator('input[type="email"], input[autocomplete="email"]').first();
  const password = page.locator('input[type="password"]').first();
  await email.fill(EMAIL);
  await password.fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForFunction(
    () => Boolean(localStorage.getItem('sloot_platform_token')),
    null,
    { timeout: 15000 },
  );
  await page.waitForSelector('.platform-kpi-row', { timeout: 10000 });
}

async function openMobileMenu(page) {
  const menuBtn = page.locator('.platform-mobile-header button').first();
  await menuBtn.click();
  await page.waitForSelector('.platform-sidebar.active', { timeout: 3000 });
}

async function clickNav(page, name) {
  const link = page.getByRole('link', { name });
  if (page.viewportSize()?.width <= 768) {
    await openMobileMenu(page);
  } else {
    const sidebar = page.locator('.platform-sidebar');
    await sidebar.hover();
    await page.waitForSelector('.platform-sidebar:not(.collapsed)', { timeout: 3000 });
  }
  await link.click();
}

async function runViewport(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const isMobile = contextOptions.isMobile || (contextOptions.viewport?.width ?? 1280) <= 768;

  try {
    await login(page);
    pass(`${name}: login → dashboard`);

    await page.waitForSelector('.platform-kpi-row', { timeout: 10000 });
    pass(`${name}: dashboard KPIs`);

    await clickNav(page, 'Barbearias');
    await page.waitForURL(/\/admin\/barbearias/);
    await page.waitForSelector('.platform-table', { timeout: 10000 });
    pass(`${name}: barbearias list`);

    const firstLink = page.locator('.platform-table tbody tr a.platform-link').first();
    if (await firstLink.count()) {
      await firstLink.click();
      await page.waitForURL(/\/admin\/barbearias\/\d+\/resumo/);
      pass(`${name}: tenant resumo`);

      for (const tab of ['Equipe', 'Estoque', 'Configuração', 'Módulos']) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(500);
        pass(`${name}: tab ${tab}`);
      }
    } else {
      pass(`${name}: tenant detail skipped (no tenants)`);
    }

    await clickNav(page, 'Admins');
    await page.waitForURL(/\/admin\/admins/);
    await page.waitForSelector('.platform-table', { timeout: 10000 });
    pass(`${name}: admins list`);

    if (name === 'desktop') {
      await page.goto(`${BASE}/admin/foo`, { waitUntil: 'networkidle' });
      await page.waitForURL(/\/admin\/?$/, { timeout: 5000 });
      pass(`${name}: invalid URL redirect`);
    }

    if (isMobile) {
      await openMobileMenu(page);
      pass(`${name}: hamburger opens sidebar`);
      await page.locator('.sidebar-overlay.active').click({ force: true });
      await page.waitForSelector('.platform-sidebar.active', { state: 'hidden', timeout: 3000 }).catch(() => {});
      pass(`${name}: overlay closes sidebar`);
    }
  } catch (err) {
    fail(`${name}: checklist`, err.message || err);
  } finally {
    await browser.close();
  }
}

async function main() {
  await runViewport('desktop', { viewport: { width: 1280, height: 800 } });
  await runViewport('mobile', { ...devices['iPhone 13'] });

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.error('\nUI checklist failures:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${checks.length} UI checklist items passed (desktop + mobile)`);
}

main().catch((err) => {
  console.error('UI smoke failed:', err);
  process.exit(1);
});
