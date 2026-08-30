import { expect, test } from '@playwright/test';
import process from 'node:process';

const tenant = process.env.PLAYWRIGHT_TENANT || 'slooti-piloto';
const canonicalPath = `/${tenant}`;

function galleryImage(label, color) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="58">${label}</text>
    </svg>
  `)}`;
}

async function mockPremiumContent(page) {
  await page.route(/\/api\/public\/bootstrap(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.business.tagline = 'Gestão. Agenda. Crescimento.';
    payload.business.bookingPage = {
      ...payload.business.bookingPage,
      heroTitle: 'Mais que um corte. Uma experiência.',
      heroText: 'Atendimento de verdade e resultados que falam por si.',
      about: 'Técnica, estilo e atendimento premium para entregar uma experiência completa.',
      coverUrl: galleryImage('Capa', '#303236'),
      galleryUrls: [galleryImage('Galeria 1', '#45484d'), galleryImage('Galeria 2', '#25272b')],
      weeklyHours: [{
        dayOfWeek: 1,
        isOpen: true,
        periods: [{ start: '09:00', end: '20:00' }],
      }],
    };
    if (payload.services?.[0]) payload.services[0].bookingIcon = 'cut';
    if (payload.services?.[1]) payload.services[1].bookingIcon = 'beard';
    if (payload.services?.[2]) payload.services[2].bookingIcon = 'combo';
    await route.fulfill({ response, json: payload });
  });
}

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
        contentWidth: document.querySelector('.mbh__content')?.getBoundingClientRect().width,
        brandOverflow: (() => {
          const brand = document.querySelector('.mbh__brand h1');
          return brand ? brand.scrollWidth > brand.clientWidth + 1 : false;
        })(),
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
      expect(layout.contentWidth).toBeLessThanOrEqual(520);
      expect(layout.brandOverflow).toBe(false);
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

  test('visual premium usa conteúdo real, ícones configurados e galeria acessível', async ({ page }) => {
    await mockPremiumContent(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(canonicalPath);

    await expect(page.getByRole('heading', { name: 'Mais que um corte. Uma experiência.' })).toBeVisible();
    await expect(page.locator('.mbh__service-icon')).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'Sobre a barbearia' })).toBeVisible();
    await expect(page.getByText('Avaliações', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Abrir foto 1 da galeria' }).click();
    const lightbox = page.getByRole('dialog', { name: 'Galeria de fotos' });
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toContainText('2/3');
    await page.keyboard.press('ArrowRight');
    await expect(lightbox).toContainText('3/3');
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
  });
});
