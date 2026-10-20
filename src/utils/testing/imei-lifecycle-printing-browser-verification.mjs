/** Feed receipts from real local JWT/SQL lifecycle tests to production printers. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const input = process.env.IMEI_INTEGRATED_RECEIPTS;
const output = process.env.IMEI_PRINT_QA_OUTPUT;
if (!input || !path.isAbsolute(input) || !output || !path.isAbsolute(output)) {
  throw new Error('Set IMEI_INTEGRATED_RECEIPTS and IMEI_PRINT_QA_OUTPUT to absolute local paths.');
}
const poppler = process.env.IMEI_QA_PDFTOPPM || 'pdftoppm';
const python = process.env.IMEI_QA_PYTHON || 'python3';

async function main() {
  const fixtures = JSON.parse(await fs.readFile(input, 'utf8'));
  assert.equal(fixtures.isolated, true);
  assert.ok(Array.isArray(fixtures.passed) && fixtures.passed.length === fixtures.checks && fixtures.checks >= 8);
  assert.equal(fixtures.scenarios.length, 6);
  const before = JSON.stringify(fixtures);
  await fs.mkdir(output, { recursive: true });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'powip-lifecycle-print-'));
  let browser;
  try {
    const bundle = path.join(temp, 'printing.js');
    await build({ stdin: { contents: "export { printOrderLabel } from './printOrderLabel'; export { buildReceiptsDocument } from './bulk-receipt-printer'; export { downloadNotaVentaPdf } from './downloadNotaVentaPdf'; export { printShippingGuide } from './printShippingGuide'; export { printCustomerShippingLabel } from './printCustomerShippingLabel';", resolveDir: path.join(root, 'src/utils'), loader: 'ts' }, bundle: true, format: 'iife', globalName: 'LifecyclePrintQA', outfile: bundle, platform: 'browser', define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'process.env.NEXT_PUBLIC_LANDING_URL': JSON.stringify('https://example.invalid') }, tsconfig: path.join(root, 'tsconfig.json') });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addScriptTag({ path: bundle });
    const reports = [];
    for (const scenario of fixtures.scenarios) {
      const guide = { guideNumber: 'GS-INTEGRATED-QA', courierName: 'Courier local de prueba', deliveryZones: ['PROVINCIAS'], status: 'CREADA', created_at: fixtures.createdAt };
      const report = { name: scenario.name, stockVersion: scenario.receipt.stockVersion, confirmedStockVersion: scenario.receipt.confirmedStockVersion, formats: [] };
      for (const method of ['printOrderLabel', 'buildReceiptsDocument', 'printShippingGuide', 'printCustomerShippingLabel']) {
        const captured = await page.evaluate(async ({ scenario, method, company, guide }) => {
          if (method === 'buildReceiptsDocument') return { html: await window.LifecyclePrintQA.buildReceiptsDocument([scenario.receipt], company), calls: 0 };
          const nativeOpen = window.open; let html = '', calls = 0;
          window.open = (...args) => {
            const popup = nativeOpen.apply(window, args);
            if (!popup) throw new Error('Real popup blocked');
            popup.print = () => { html = popup.document.documentElement.outerHTML; calls++; };
            return popup;
          };
          try {
            const operation = method === 'printShippingGuide'
              ? window.LifecyclePrintQA.printShippingGuide(guide, [{ ...scenario.receipt, id: scenario.receipt.orderId }], company)
              : window.LifecyclePrintQA[method](scenario.receipt, method === 'printOrderLabel' ? scenario.orderHeader : guide, company);
            await Promise.race([operation, new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} popup did not finish`)), 10000))]);
            return { html, calls };
          } finally { window.open = nativeOpen; }
        }, { scenario, method, company: fixtures.company, guide });
        if (method !== 'buildReceiptsDocument') assert.equal(captured.calls, 1);
        const render = await browser.newPage({ viewport: { width: method === 'printShippingGuide' ? 794 : 420, height: 1400 } });
        await render.setContent(captured.html);
        const visibleCodes = await render.locator('.unit-code').allTextContents();
        assert.deepEqual(visibleCodes.map(value => value.replace(/^(?:IMEI|Serie):\s*/, '')), scenario.expectedCodes);
        if (scenario.expectedNotice) assert.ok((await render.locator('body').innerText()).includes(scenario.expectedNotice));
        for (const code of scenario.expectedAbsentCodes ?? []) assert.ok(!(await render.locator('body').innerText()).includes(code));
        assert.equal(await render.locator('.unit-code').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).length), 0);
        if (scenario.name === 'none-delivered') assert.equal(await render.locator('.unit-codes').count(), 0);
        const name = `${scenario.name}-${method}`;
        await fs.writeFile(path.join(output, `${name}.html`), captured.html);
        const pdf = await render.pdf(method === 'printShippingGuide' ? { format: 'A4', printBackground: true } : { width: '100mm', height: '297mm', printBackground: true });
        const expectedFile = path.join(temp, 'expected.json');
        await fs.writeFile(expectedFile, JSON.stringify({ codes: scenario.expectedCodes, absent: scenario.expectedAbsentCodes ?? [] }));
        const checked = spawnSync(python, ['-c', "import io,json,re,sys\nfrom pypdf import PdfReader\nr=PdfReader(io.BytesIO(sys.stdin.buffer.read()))\npages=[re.sub(r'\\s+','',p.extract_text()) for p in r.pages]\ne=json.load(open(sys.argv[1]))\nfor code in e['codes']:\n assert sum(p.count(code) for p in pages)==1,code\nfor code in e['absent']:\n assert all(code not in p for p in pages),code\nprint(json.dumps({'pages':len(r.pages),'verifiedCodes':len(e['codes'])}))", expectedFile], { input: pdf, encoding: 'utf8' });
        assert.equal(checked.status, 0, checked.stderr);
        const rendered = spawnSync(poppler, ['-r', '90', '-png', '-', path.join(output, `${name}-render`)], { input: pdf });
        assert.equal(rendered.status, 0, rendered.stderr?.toString());
        report.formats.push({ name: method, actualPopupPrintCalls: captured.calls, ...JSON.parse(checked.stdout) });
        await render.close();
      }
      const download = page.waitForEvent('download', { timeout: 30000 });
      const actual = await page.evaluate(async ({ scenario, company }) => {
        const originalRemove = Element.prototype.remove; let result = null;
        Element.prototype.remove = function () {
          if (this.tagName === 'IFRAME') {
            const root = this.contentDocument?.getElementById('pdf-comprobante-root');
            if (root?.querySelector('[data-pdf-page]')) {
              result = { pages: root.querySelectorAll('[data-pdf-page]').length, codes: [...root.querySelectorAll('[data-pdf-unit-code]')].map(row => row.dataset.pdfUnitCode), text: root.innerText };
            }
          }
          return originalRemove.call(this);
        };
        try { await window.LifecyclePrintQA.downloadNotaVentaPdf(scenario.receipt, scenario.orderHeader, company); return result; }
        finally { Element.prototype.remove = originalRemove; }
      }, { scenario, company: fixtures.company });
      assert.ok(actual);
      assert.deepEqual(actual.codes, scenario.expectedCodes);
      if (scenario.expectedNotice) assert.ok(actual.text.includes(scenario.expectedNotice));
      for (const code of scenario.expectedAbsentCodes ?? []) assert.ok(!actual.text.includes(code));
      const pdfPath = path.join(output, `${scenario.name}-nota.pdf`);
      await (await download).saveAs(pdfPath);
      const rendered = spawnSync(poppler, ['-r', '90', '-png', pdfPath, path.join(output, `${scenario.name}-nota-render`)]);
      assert.equal(rendered.status, 0, rendered.stderr?.toString());
      report.formats.push({ name: 'downloadNotaVentaPdf', pages: actual.pages, codesFromActualProductionPages: actual.codes.length, rasterPdf: true });
      reports.push(report);
    }
    assert.deepEqual(errors, []);
    assert.equal(JSON.stringify(fixtures), before, 'Printing must not mutate quantities, payments or snapshots');
    const report = { passed: true, source: input, sourceProof: fixtures.scopeProof, limitations: fixtures.limitations, boundary: 'Real local JWT/SQL receipts exported from lifecycle -> production printers in real Chromium', scenarios: reports, errors, receiptDataUnchanged: true };
    await fs.writeFile(path.join(output, 'lifecycle-printing-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser?.close(); await fs.rm(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
