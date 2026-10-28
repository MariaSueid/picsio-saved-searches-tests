import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { STORAGE_STATE } from '../playwright.config';

setup('log in to Pics.io', async ({ page }) => {
  const email = process.env.PICSIO_EMAIL;
  const password = process.env.PICSIO_PASSWORD;

  if (!email || !password) {
    // No credentials: reuse the session saved by `npm run auth` (Google / Microsoft sign-in)
    if (!fs.existsSync(STORAGE_STATE)) {
      throw new Error('No session found. Run `npm run auth` or set PICSIO_EMAIL / PICSIO_PASSWORD in .env');
    }
    await page.context().addCookies(JSON.parse(fs.readFileSync(STORAGE_STATE, 'utf8')).cookies);
    await page.goto('/search');
    await expect(page, 'Saved session expired, run `npm run auth` again').not.toHaveURL(/\/login/);
    return;
  }

  await page.goto('/login');
  const acceptCookies = page.getByRole('button', { name: 'Accept All' });
  if (await acceptCookies.isVisible({ timeout: 5_000 }).catch(() => false)) await acceptCookies.click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await page.context().storageState({ path: STORAGE_STATE });
});
