/** Exercise real popup lifecycle and courier pagination with synthetic data only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.IMEI_PRINT_QA_OUTPUT;
if (!output || !path.isAbsolute(output)) throw new Error('Set IMEI_PRINT_QA_OUTPUT to an absolute local evidence directory.');
const python = process.env.IMEI_QA_PYTHON || 'python3';
const poppler = process.env.IMEI_QA_PDFTOPPM || 'pdftoppm';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (mode, quantity, offset) => {
  const units = mode === 'NONE' ? [] : Array.from({ length: quantity }, (_, n) => ({
    id: id(offset + n), status: 'RESERVED', code: mode === 'IMEI'
      ? String(1234567890000 + offset + n).padStart(15, '0')
      : `SERIE-${String(offset + n).padStart(3, '0')}-${'A'.repeat(90)}`,
  }));
  return { productName: mode === 'NONE' ? 'Cable USB por cantidad' : mode === 'IMEI' ? 'Teléfono con IMEI' : 'Terminal con serie extensa', sku: mode, quantity, trackingMode: mode, unitPrice: 10, subtotal: quantity * 10, discountAmount: 0, ...(units.length ? { units, unitIds: units.map(unit => unit.id) } : {}) };
};
const receipt = (number, items) => ({
  id: id(number), orderId: id(number), orderNumber: `QA-${number}`, status: 'PREPARADO',
  createdAt: '2026-10-17T15:00:00.000Z', customer: { fullName: 'Cliente de prueba', dni: '00000000', phoneNumber: '999000111', address: 'Av. de prueba 123', district: 'Miraflores', city: 'Lima', province: 'Lima' },
  unitCatalogValidated: true, unitAssignmentStatus: items.some(item => item.trackingMode !== 'NONE') ? 'CONFIRMED' : 'NONE', stockVersion: 4, confirmedStockVersion: 4,
  items, payments: [], totals: { productsTotal: items.reduce((sum, item) => sum + item.subtotal, 0), taxTotal: 0, shippingTotal: 0, discountTotal: 0, grandTotal: items.reduce((sum, item) => sum + item.subtotal, 0), totalPaid: 0, pendingAmount: items.reduce((sum, item) => sum + item.subtotal, 0) },
});
const cases = [
  ['quantity', receipt(1, [line('NONE', 3, 0)])],
  ['mixed', receipt(2, [line('NONE', 3, 0), line('IMEI', 2, 100), line('SERIAL', 2, 200)])],
  ['long-series', receipt(3, [line('NONE', 3, 0), line('IMEI', 3, 300), line('SERIAL', 80, 400)])],
];
const guide = { guideNumber: 'GS-QA-001', courierName: 'Courier de prueba', deliveryZones: ['PROVINCIAS'], status: 'CREADA', created_at: '2026-10-17T15:00:00.000Z' };
const company = { name: 'Empresa de prueba', cuit: '00000000000', billingAddress: 'Lima' };

async function main() {
  await fs.mkdir(output, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'powip-courier-print-'));
  let browser;
  try {
    const bundle = path.join(temporary, 'printing.js');
    await build({ stdin: { contents: "export {printShippingGuide} from './printShippingGuide'; export {printCustomerShippingLabel} from './printCustomerShippingLabel'; export {printOrderLabel} from './printOrderLabel';", resolveDir: path.join(root, 'src/utils'), loader: 'ts' }, bundle: true, format: 'iife', globalName: 'CourierPrintQA', outfile: bundle, platform: 'browser', define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.NEXT_PUBLIC_LANDING_URL': JSON.stringify('https://example.invalid') }, tsconfig: path.join(root, 'tsconfig.json') });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addScriptTag({ path: bundle });
    const reports = [];
    for (const [kind, method] of [['shipping-guide', 'printShippingGuide'], ['customer-shipping-label', 'printCustomerShippingLabel'], ['order-label-popup', 'printOrderLabel']]) {
      for (const [name, data] of cases) {
        const captured = await page.evaluate(async ({ method, data, guide, company }) => {
          const nativeOpen = window.open;
          let html = '', calls = 0;
          window.open = (...args) => {
            const popup = nativeOpen.apply(window, args);
            if (!popup) throw new Error('Real popup was blocked');
            popup.print = () => { html = popup.document.documentElement.outerHTML; calls++; };
            return popup;
          };
          try {
            await Promise.race([
              method === 'printShippingGuide' ? window.CourierPrintQA[method](guide, [data], company)
                : window.CourierPrintQA[method](data, method === 'printOrderLabel' ? { status: 'PREPARADO' } : guide, company),
              new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} did not finish its real popup`)), 10000)),
            ]);
            return { html, calls };
          } finally { window.open = nativeOpen; }
        }, { method, data, guide, company });
        assert.equal(captured.calls, 1, `${kind}/${name} must actually call print`);
        if (kind === 'order-label-popup') {
          reports.push({ name: `${kind}-${name}`, actualPopupPrintCalls: captured.calls });
          continue;
        }
        const title = `${kind}-${name}`;
        await fs.writeFile(path.join(output, `${title}.html`), captured.html);
        const render = await browser.newPage({ viewport: { width: kind === 'shipping-guide' ? 794 : 420, height: 1400 } });
        await render.setContent(captured.html);
        await render.evaluate(() => document.fonts.ready);
        const expected = data.items.flatMap(item => (item.units ?? []).map(unit => unit.code));
        const codes = await render.locator('.unit-code').allTextContents();
        assert.equal(codes.length, expected.length);
        assert.equal(await render.locator('.unit-code').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).length), 0);
        const pdf = await render.pdf(kind === 'shipping-guide' ? { format: 'A4', printBackground: true } : { width: '100mm', height: '297mm', printBackground: true });
        // Keep six deliverable QA PDFs from the main verifier; these extra print
        // jobs are validated in memory and retained as HTML plus rendered PNGs.
        const expectedPath = path.join(temporary, 'expected.json');
        await fs.writeFile(expectedPath, JSON.stringify(expected));
        const verified = spawnSync(python, ['-c', "import io,json,re,sys\nfrom pypdf import PdfReader\nr=PdfReader(io.BytesIO(sys.stdin.buffer.read()))\npages=[re.sub(r'\\s+','',p.extract_text()) for p in r.pages]\nexpected=json.load(open(sys.argv[1]))\nfor code in expected:\n count=sum(page.count(code) for page in pages)\n assert count==1, (code,count,'must be complete on one page')\nprint(json.dumps({'pages':len(r.pages),'codesVerifiedExactlyOnceOnSinglePage':len(expected)}))", expectedPath], { input: pdf, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        assert.equal(verified.status, 0, verified.stderr);
        for (const previous of await fs.readdir(output)) {
          if (previous.startsWith(`${title}-render-`) && previous.endsWith('.png')) await fs.rm(path.join(output, previous));
        }
        const rendered = spawnSync(poppler, ['-r', '90', '-png', '-', path.join(output, `${title}-render`)], { input: pdf, maxBuffer: 10 * 1024 * 1024 });
        assert.equal(rendered.status, 0, rendered.stderr?.toString());
        reports.push({ name: title, actualPopupPrintCalls: captured.calls, ...JSON.parse(verified.stdout) });
        await render.close();
      }
    }
    assert.deepEqual(errors, []);
    const report = { browser: 'Chromium real popups', syntheticData: true, reports, errors };
    await fs.writeFile(path.join(output, 'courier-browser-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally { await browser?.close(); await fs.rm(temporary, { recursive: true, force: true }); }
}
main().catch(error => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
