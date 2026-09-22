import { test, expect } from 'playwright/test';

const baseURL = process.env.SYNAPSEMAX_BROWSER_URL || 'http://127.0.0.1:8788';

test.use({ baseURL, reducedMotion: 'reduce' });

test('H1 critical journey: landing to assessment result and CTA', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(pageErrors).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.__SYNAPSEMAX_RUNTIME__ === true)).toBe(true);

  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: /Диагностика/i })).toBeVisible();

  const assessment = page.locator('#assessment');
  await assessment.scrollIntoViewIfNeeded();
  for (const id of ['complexity', 'manualWork', 'dataFragmentation', 'errorRate']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
  }

  await page.locator('#complexity').fill('80');
  await page.locator('#manualWork').fill('70');
  await page.locator('#dataFragmentation').fill('60');
  await page.locator('#errorRate').fill('30');

  const submit = assessment.locator('button[type="submit"]');
  await submit.focus();
  await expect(submit).toBeFocused();
  await submit.click();

  const result = page.locator('#assessment-report');
  await expect(result).toBeVisible();
  await expect(page.locator('body')).toContainText(/60/);

  const cta = page.getByRole('link', { name: /обсудить результат|получить карту трансформации/i }).first();
  await expect(cta).toBeVisible();

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  let keyboardFocused = false;
  for (let step = 0; step < 120; step += 1) {
    await page.keyboard.press('Tab');
    keyboardFocused = await submit.evaluate((el) => document.activeElement === el);
    if (keyboardFocused) break;
  }
  expect(keyboardFocused).toBeTruthy();

  const focusRing = await submit.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== 'none' || s.boxShadow !== 'none';
  });
  expect(focusRing).toBeTruthy();
});

test('H1 finance journey: profit leakage to ROI, scenarios, margin impact and Action Map', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(pageErrors).toEqual([]);

  const finance = page.locator('#profit-leakage');
  await finance.scrollIntoViewIfNeeded();
  for (const id of ['leak-labor', 'leak-manual', 'leak-recoverable', 'leak-errors', 'leak-delays', 'leak-impl']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }

  await page.locator('#leak-labor').fill('1000000');
  await page.locator('#leak-manual').fill('50');
  await page.locator('#leak-recoverable').fill('40');
  await page.locator('#leak-errors').fill('100000');
  await page.locator('#leak-delays').fill('50000');
  await page.locator('#leak-impl').fill('1500000');

  const impact = page.locator('#finance-impact');
  await impact.scrollIntoViewIfNeeded();
  for (const id of ['impact-error-recovery', 'impact-delay-recovery', 'impact-error-overlap', 'impact-delay-overlap', 'impact-error-delay-overlap', 'impact-evidence', 'impact-revenue', 'impact-margin', 'impact-capex', 'impact-opex', 'impact-annual-opex']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await page.locator('#impact-error-recovery').fill('50');
  await page.locator('#impact-delay-recovery').fill('20');
  await page.locator('#impact-evidence').fill('80');
  await page.locator('#impact-revenue').fill('5000000');
  await page.locator('#impact-margin').fill('20');
  await page.locator('#finance-impact-button').click();

  const impactResult = page.locator('#finance-impact-result');
  await expect(impactResult).toBeVisible();
  await expect(impactResult).toContainText('Экономический эффект');
  await expect(impactResult).toContainText('Action Map');
  await expect(impactResult.locator('[data-impact="recoverable"] b')).toHaveText('260 000 ₽');
  await expect(impactResult.locator('[data-impact="annual"] b')).toHaveText('3 120 000 ₽');
  await expect(impactResult.locator('[data-impact="roi"] b')).toHaveText('108%');
  await expect(impactResult.locator('[data-impact="payback"] b')).toHaveText('5.8 мес.');
  await expect(impactResult.locator('[data-impact="margin"] b')).toHaveText('+5.2 п.п.');
  await expect(impactResult.locator('[data-scenario="conservative"] strong')).toHaveText('2 184 000 ₽');
  await expect(impactResult.locator('[data-scenario="base"] strong')).toHaveText('3 120 000 ₽');
  await expect(impactResult.locator('[data-scenario="optimistic"] strong')).toHaveText('3 588 000 ₽');
  await expect(impactResult).toContainText('Качество evidence: Высокая');
  await expect(impactResult.locator('.finance-impact-action')).toHaveCount(3);
});

test('H1 mobile remains usable and does not overflow horizontally', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('#assessment')).toBeVisible();
  await expect(page.locator('#contact')).toBeVisible();
  await context.close();
});


test('Client portal page loads without runtime errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/portal.html', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/Client Portal/i);
  await expect(page.getByText('Финансовый контур')).toBeVisible();
  await expect(page.locator('#sessions')).toHaveText('—');
  await expect(page.locator('#status')).toContainText(/Войти|данные/i);
  expect(pageErrors).toEqual([]);
});

test('Auth page loads without runtime errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/auth.html', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/SynapseMax.*вход/i);
  await expect(page.getByText('Neon Auth / production smoke test')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#submit')).toHaveText('Войти');
  expect(pageErrors).toEqual([]);
});
