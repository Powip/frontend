/** Real browser verification of the production print builders, with synthetic data only. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.IMEI_PRINT_QA_OUTPUT;
if (!output || !path.isAbsolute(output)) throw new Error('Set IMEI_PRINT_QA_OUTPUT to a local absolute evidence directory.');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function line(mode,quantity,offset) {
  const units = mode === 'NONE' ? [] : Array.from({length:quantity},(_,n)=>({id:id(offset+n),code:mode==='IMEI' ? String(1234567890000+offset+n).padStart(15,'0') : `SERIE-${String(offset+n).padStart(3,'0')}-${'A'.repeat(90)}`,status:'RESERVED'}));
  return {productName:mode==='NONE'?'Cable USB por cantidad':mode==='IMEI'?'Teléfono con IMEI':'Terminal con serie extensa',sku:mode==='NONE'?'CABLE-USB':mode==='IMEI'?'PHONE-IMEI':'TERMINAL-SERIAL',quantity,trackingMode:mode,...(mode==='NONE'?{}:{units,unitIds:units.map(u=>u.id)}),unitPrice:10,subtotal:quantity*10,discountAmount:0,attributes:{Color:'Negro'}};
}
function receipt(orderNumber,items) {
  const tracked=items.some(i=>i.trackingMode!=='NONE'),total=items.reduce((sum,item)=>sum+item.subtotal,0);
  return {orderId:id(900+Number(orderNumber.slice(-1))),orderNumber,status:'PREPARADO',receiptType:'BOLETA',createdAt:'2026-10-17T15:00:00.000Z',salesChannel:'WHATSAPP',unitAssignmentStatus:tracked?'CONFIRMED':'NONE',unitCatalogValidated:true,stockVersion:tracked?4:0,confirmedStockVersion:tracked?4:null,customer:{fullName:'Cliente de prueba',phoneNumber:'999000111',dni:'00000000',address:'Av. de prueba 123',district:'Miraflores',city:'Lima',province:'Lima'},items,payments:[],totals:{productsTotal:total,taxTotal:0,shippingTotal:0,discountTotal:0,grandTotal:total,totalPaid:0,pendingAmount:total}};
}
const company={name:'Empresa de prueba',cuit:'00000000000',billingAddress:'Lima'};
const header={status:'PREPARADO',deliveryType:'DOMICILIO',courier:'Courier de prueba'};
const ordinary=receipt('QA-001',[line('NONE',3,0)]);
const mixed=receipt('QA-002',[line('NONE',3,0),line('IMEI',2,100),line('SERIAL',2,200)]);
const long=receipt('QA-003',[line('NONE',3,0),line('IMEI',3,300),line('SERIAL',80,400)]);
const expectedCodes=r=>r.items.flatMap(item=>(item.units??[]).map(unit=>unit.code));

async function main() {
  await fs.mkdir(output,{recursive:true});
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'powip-imei-print-'));
  const bundle=path.join(temp,'printing.js');
  let browser;
  try {
    await build({stdin:{contents:`export {printOrderLabel} from './printOrderLabel'; export {buildReceiptsDocument} from './bulk-receipt-printer'; export {buildNotaVentaHtml,paginateNotaVentaDocument,downloadNotaVentaPdf} from './downloadNotaVentaPdf';`,resolveDir:path.join(root,'src/utils'),loader:'ts'},bundle:true,format:'iife',globalName:'PowipPrintQA',outfile:bundle,platform:'browser',define:{'process.env.NEXT_PUBLIC_LANDING_URL':JSON.stringify('https://example.invalid'),'process.env.NODE_ENV':JSON.stringify('production')},tsconfig:path.join(root,'tsconfig.json')});
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1000,height:1400},acceptDownloads:true});
    const failures=[];
    page.on('pageerror',error=>failures.push(error.message));
    await page.addScriptTag({path:bundle});
    const labelReports=[];
    for(const [name,data] of [['label-quantity',ordinary],['label-mixed',mixed],['label-long-series',long]]) {
      const html=await page.evaluate(async({data,company,header})=>{
        const original=window.open;let captured='';let win;
        window.open=()=>{win={document:{write:html=>{captured=html},close:()=>setTimeout(()=>win.onload?.(),0)},onload:null,focus(){},print(){},close(){}};return win};
        try {await window.PowipPrintQA.printOrderLabel(data,header,company);return captured} finally {window.open=original}
      },{data,company,header});
      await fs.writeFile(path.join(output,`${name}.html`),html);
      const render=await browser.newPage({viewport:{width:420,height:1400}});await render.setContent(html);await render.evaluate(()=>document.fonts.ready);
      const codes=await render.locator('.unit-code').allTextContents();
      assert.deepEqual(codes,expectedCodes(data).map(code=>`${data.items.find(i=>i.units?.some(u=>u.code===code)).trackingMode==='IMEI'?'IMEI':'Serie'}: ${code}`));
      const clipped=await render.locator('.unit-code').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).length);assert.equal(clipped,0);
      await render.pdf({path:path.join(output,`${name}.pdf`),width:'100mm',height:'297mm',printBackground:true,margin:{top:'5mm',bottom:'5mm',left:'5mm',right:'5mm'}});
      await render.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
      labelReports.push({name,codes:codes.length,clipped});await render.close();
    }
    const bulk=await page.evaluate(async({receipts,company})=>window.PowipPrintQA.buildReceiptsDocument(receipts,company),{receipts:[ordinary,mixed,long],company});
    await fs.writeFile(path.join(output,'bulk-mixed.html'),bulk);
    const bulkPage=await browser.newPage({viewport:{width:420,height:1400}});await bulkPage.setContent(bulk);await bulkPage.evaluate(()=>document.fonts.ready);
    const bulkCodes=await bulkPage.locator('.unit-code').allTextContents();assert.equal(bulkCodes.length,expectedCodes(mixed).length+expectedCodes(long).length);
    assert.equal(await bulkPage.locator('.unit-code').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).length),0);
    await bulkPage.pdf({path:path.join(output,'bulk-mixed.pdf'),width:'100mm',height:'297mm',printBackground:true});await bulkPage.close();
    const noteReports=[];
    for(const [name,data] of [['nota-quantity',ordinary],['nota-long-series',long]]) {
      const html=await page.evaluate(({data,header,company})=>window.PowipPrintQA.buildNotaVentaHtml(data,header,company),{data,header,company});
      await fs.writeFile(path.join(output,`${name}.html`),html);
      const layout=await browser.newPage({viewport:{width:800,height:1400}});await layout.setContent(html);await layout.addScriptTag({path:bundle});
      const details=await layout.evaluate(()=>{
        const root=document.getElementById('pdf-comprobante-root');const pages=window.PowipPrintQA.paginateNotaVentaDocument(root);
        return {pages:pages.length,codes:[...root.querySelectorAll('[data-pdf-unit-code]')].map(row=>row.dataset.pdfUnitCode),overflow:pages.flatMap(page=>{const bounds=page.getBoundingClientRect();return [...page.querySelectorAll('.nota-venta-content > *,[data-pdf-unit-code]')].filter(node=>{const r=node.getBoundingClientRect();return r.bottom>bounds.bottom-30||r.right>bounds.right||r.left<bounds.left}).map(node=>node.textContent)})};
      });
      assert.deepEqual(details.codes,expectedCodes(data));assert.deepEqual(details.overflow,[]);assert.equal(new Set(details.codes).size,details.codes.length);
      if(name==='nota-quantity')assert.equal(details.pages,1);else assert.ok(details.pages>1);
      for(let index=0;index<details.pages;index++)await layout.locator('[data-pdf-page]').nth(index).screenshot({path:path.join(output,`${name}-layout-${index+1}.png`)});
      await layout.close();
      const download=page.waitForEvent('download');
      const actual=await page.evaluate(async({data,header,company})=>{
        const original=Element.prototype.remove;let captured=null;
        Element.prototype.remove=function(){
          if(this.tagName==='IFRAME') {
            const root=this.contentDocument?.getElementById('pdf-comprobante-root');
            if(root?.querySelector('[data-pdf-page]')) {
              const pages=[...root.querySelectorAll('[data-pdf-page]')];
              captured={pages:pages.length,codes:[...root.querySelectorAll('[data-pdf-unit-code]')].map(row=>row.dataset.pdfUnitCode),overflow:pages.flatMap(page=>{const b=page.getBoundingClientRect();return [...page.querySelectorAll('.nota-venta-content > *,[data-pdf-unit-code]')].filter(node=>{const r=node.getBoundingClientRect();return r.bottom>b.bottom-30||r.right>b.right||r.left<b.left}).map(node=>node.textContent)})};
            }
          }
          return original.call(this);
        };
        try{await window.PowipPrintQA.downloadNotaVentaPdf(data,header,company);return captured}finally{Element.prototype.remove=original}
      },{data,header,company});
      const file=await download;await file.saveAs(path.join(output,`${name}.pdf`));
      assert.ok(actual);assert.deepEqual(actual.codes,expectedCodes(data));assert.deepEqual(actual.overflow,[]);
      noteReports.push({name,...actual,previewPages:details.pages});
    }
    assert.deepEqual(failures,[]);
    const report={browser:'Chromium real',syntheticData:true,labels:labelReports,bulk:{receipts:3,codes:bulkCodes.length},notes:noteReports,errors:failures};
    await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  } finally {await browser?.close();await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{process.stderr.write(`${error.stack||error}\n`);process.exitCode=1});
