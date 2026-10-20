/** Read-only runtime smoke of the locally built production application. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = new URL(process.env.IMEI_FRONTEND_BASE_URL || 'http://127.0.0.1:56438');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Only a local qualification server is allowed');
const output = process.env.IMEI_PRINT_QA_OUTPUT;
assert.ok(output && path.isAbsolute(output), 'Set IMEI_PRINT_QA_OUTPUT to an absolute local evidence directory');
await fs.mkdir(output, { recursive: true });
const routes = ['/login', '/inventario', '/compras', '/registrar-compra', '/registrar-venta', '/ventas', '/finanzas', '/operaciones/pedidos', '/onboarding', '/facturacion'];
const results = [];
for (const route of routes) {
  const response = await fetch(new URL(route, base));
  const html = await response.text();
  assert.equal(response.status, 200, route);
  assert.ok(html.includes('<html'), route);
  results.push({ route, status: response.status, html: true });
}
const csrf = await fetch(new URL('/api/auth/refresh', base), { method: 'POST' });
assert.equal(csrf.status, 403);
const origin = new URL(base); origin.protocol = 'https:';
const refresh = await fetch(new URL('/api/auth/refresh', base), { method: 'POST', headers: { Origin: origin.origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: '{}' });
assert.equal(refresh.status, 401);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], failedAssets = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(base.origin) && /\.(?:js|css|woff2?)(?:\?|$)/.test(response.url()) && response.status() >= 400) failedAssets.push({ url: response.url(), status: response.status() });
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { externalRequests.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto(new URL('/login', base).href, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').waitFor();
  await page.locator('input[type="password"]').waitFor();
  assert.ok((await page.locator('body').innerText()).includes('Iniciar'));
  await page.screenshot({ path: path.join(output, 'production-login.png'), fullPage: true });
  await page.goto(new URL('/inventario', base).href, { waitUntil: 'networkidle' });
  await page.waitForURL(url => url.pathname === '/login');
  await page.locator('input[type="email"]').waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  const report = { passed: true, mode: 'standalone production, isolated local copy with cloned dependencies', routes: results, refreshWithoutOrigin: csrf.status, refreshWithoutSession: refresh.status, browser: { loginHydrated: true, unauthenticatedInventoryRedirectsToLogin: true, runtimeErrors: errors, failedStaticAssets: failedAssets, externalOriginsBlocked: [...new Set(externalRequests)] }, limitation: 'No authenticated manual order entry or external courier/printer is exercised by this smoke; JWT/SQL lifecycle and production printers are validated separately.' };
  await fs.writeFile(path.join(output, 'production-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
