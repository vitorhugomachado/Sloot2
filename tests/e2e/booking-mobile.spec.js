import { expect, test } from '@playwright/test';
import process from 'node:process';

const tenant = process.env.PLAYWRIGHT_TENANT || 'slooti-piloto';
const canonicalPath = `/${tenant}`;

test.describe('agendamento mobile definitivo', () => {
  for (const width of [320, 375, 430, 768, 1023]) {
    test(`hub real sem moldura ou overflow em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(canonicalPath);

      await expect(page.locator('.mbh')).toBeVisible();
      await expect(page.locator('.mobile-booking-test, .phone-frame')).toHaveCount(0);
      await expect(page.locator('.slooti-brand-header')).toBeHidden();
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
    });
  }

  for (const width of [1024, 1440]) {
    test(`desktop existente permanece em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(canonicalPath);

      await expect(page.locator('.booking-preview--desktop')).toBeVisible();
      await expect(page.locator('.mbh')).toHaveCount(0);
      await expect(page.locator('.slooti-brand-header')).toBeVisible();
    });
  }

  test('serviço abre o passo profissional e Voltar retorna ao hub', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(canonicalPath);
    await page.locator('.mbh__services button').first().click();

    await expect(page).toHaveURL(/\?agendar=1&servico=\d+/);
    await expect(page.getByRole('heading', { name: 'Escolha o profissional' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page).toHaveURL(new RegExp(`/${tenant}/?$`));
    await expect(page.locator('.mbh')).toBeVisible();
  });

  test('preferência de profissional pula para data após a escolha do serviço', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(canonicalPath);
    await page.locator('.mbh__professionals button').first().click();

    await expect(page).toHaveURL(/profissional=\d+/);
    await page.locator('.bp-service-card').first().click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Escolha a data e horário' })).toBeVisible();
  });

  test('seleções sobrevivem ao resize sem criar um segundo fluxo', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(canonicalPath);
    const serviceName = await page.locator('.mbh__services strong').first().innerText();
    await page.locator('.mbh__services button').first().click();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator('.bp-desk-pick-card--selected')).toContainText(serviceName);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('heading', { name: 'Escolha o profissional' })).toBeVisible();
  });

  test('ID removido é descartado com aviso operacional verdadeiro', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${canonicalPath}?agendar=1&servico=999999`);

    await expect(page.getByRole('status')).toContainText(/serviço.*não está mais disponível/i);
    await expect(page).not.toHaveURL(/servico=/);
    await expect(page.getByRole('heading', { name: 'Agende seu horário' })).toBeVisible();
  });

  test('Conta abre o login e compartilhar copia somente a URL canônica', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(canonicalPath);

    await page.getByRole('button', { name: 'Compartilhar' }).click();
    await expect(page.getByRole('status')).toHaveText('Link copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      new URL(canonicalPath, page.url()).href,
    );

    await page.getByRole('button', { name: 'Entrar na conta' }).click();
    await expect(page.getByText('Entrar na sua conta', { exact: true })).toBeVisible();
  });
});
