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

  // Verify the real keyboard path rather than programmatic focus().
  // focus-visible intentionally follows keyboard modality and is not
  // guaranteed to match after HTMLElement.focus().
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
