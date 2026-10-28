// One-time manual login (e.g. "Sign in with Google") that saves the Pics.io session for the tests.
// No password is stored: only the session cookies end up in playwright/.auth/user.json (git-ignored).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const STORAGE_STATE = 'playwright/.auth/user.json';

const context = await chromium.launchPersistentContext('playwright/.auth/chrome-profile', {
  channel: 'chrome', // real Google Chrome: Google refuses sign-in from the bundled Chromium
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto('https://pics.io/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });

console.log('Log in in the opened browser window. Waiting up to 5 minutes...');
// Google sign-in may continue in a new tab, so watch every tab until one leaves /login
const loggedIn = (url: string) => /^https:\/\/pics\.io\/(?!login)/.test(url);
const deadline = Date.now() + 300_000;
while (!context.pages().some((p) => loggedIn(p.url()))) {
  if (Date.now() > deadline) throw new Error('Timed out waiting for login');
  await new Promise((r) => setTimeout(r, 1_000));
}
await new Promise((r) => setTimeout(r, 5_000)); // let the app finish setting its session cookies

// Keep only Pics.io cookies: the Google account session must not end up on disk
const state = await context.storageState();
state.cookies = state.cookies.filter((c) => /(^|\.)pics\.io$/.test(c.domain));
fs.writeFileSync(STORAGE_STATE, JSON.stringify(state, null, 2));
console.log(`Session saved to ${STORAGE_STATE}`);
await context.close();
// The temporary Chrome profile still holds the Google session, so don't leave it on disk
fs.rmSync('playwright/.auth/chrome-profile', { recursive: true, force: true });
