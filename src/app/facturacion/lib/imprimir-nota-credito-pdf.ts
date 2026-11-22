import { toast } from "sonner";
import { escapeHtml, initials, type PrintIssuer } from "@/app/facturacion/lib/imprimir-html";
import { calcularMontosNota, formatMotivoNota } from "@/app/facturacion/lib/motivos-nota-credito";
import type { Nota } from "@/types/facturacion";

export type NotaIssuer = PrintIssuer;

const TIPO_ORIGINAL_LABEL: Record<"01" | "03", string> = {
  "01": "Factura electrónica (01)",
  "03": "Boleta de venta electrónica (03)",
};

function tipoOriginalDe(nota: Nota): "01" | "03" | undefined {
  if (nota.tipoOriginal) {
    return nota.tipoOriginal;
  }

  // Notas antiguas sin tipo: la serie lo indica (F = factura, B = boleta).
  const first = nota.original.trim().charAt(0).toUpperCase();
  if (first === "F") return "01";
  if (first === "B") return "03";
  return undefined;
}

const money = (value: number) => `S/ ${value.toFixed(2)}`;

/**
 * HTML imprimible (A4) de una nota de crédito con el mismo layout que la
 * guía de remisión y la boleta.
 *
 * Las notas todavía son mock local (useFacturacionMock): no se envían a
 * SUNAT. El documento lo dice y no muestra el estado "ACEPTADO" del mock
 * para no afirmar una validez que no tiene.
 */
export function buildNotaCreditoHtml(nota: Nota, issuer: NotaIssuer): string {
  const montos =
    nota.subtotal !== undefined && nota.igv !== undefined
      ? { subtotal: nota.subtotal, igv: nota.igv, total: nota.monto }
      : calcularMontosNota(nota.monto);

  const tipo = tipoOriginalDe(nota);
  const documentoModificado = tipo
    ? `${TIPO_ORIGINAL_LABEL[tipo]} ${nota.original}`
    : nota.original;

  const companyName = issuer.razonSocial || "—";
  const companyMeta = [issuer.ruc ? `RUC ${issuer.ruc}` : null, issuer.direccion || null]
    .filter(Boolean)
    .join(" · ");

  const items = nota.items?.length
    ? nota.items
    : [
        {
          descripcion: `Ajuste por ${nota.motivo}`,
          cantidad: 1,
          precioUnitario: nota.monto,
          importe: nota.monto,
        },
      ];

  const itemRows = items
    .map(
      (item, index) => `
              <tr>
                <td>${String(index + 1).padStart(2, "0")}</td>
                <td><b>${escapeHtml(item.descripcion)}</b></td>
                <td class="num">${escapeHtml(item.cantidad)}</td>
                <td class="num">${escapeHtml(money(item.precioUnitario))}</td>
                <td class="num">${escapeHtml(money(item.importe))}</td>
              </tr>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Nota de Crédito ${escapeHtml(nota.num)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <style>
          @page { size: A4; margin: 12mm 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: "Montserrat", -apple-system, sans-serif;
            color: #101828; font-size: 11px; margin: 0; line-height: 1.4;
          }
          .sheet { width: 100%; max-width: 800px; margin: 0 auto; padding: 16px 20px 24px; }
          .head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
          .company { display: flex; gap: 14px; align-items: center; }
          .logo-box {
            width: 56px; height: 56px; border-radius: 10px; background: #4C2FB5; color: #fff;
            display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700;
            flex-shrink: 0; font-family: "Poppins", sans-serif;
          }
          .company-name { font-size: 20px; font-weight: 700; font-family: "Poppins", sans-serif; }
          .company-meta { font-size: 10.5px; color: #667085; margin-top: 3px; }
          .doc-info { text-align: right; }
          .doc-badge {
            display: inline-block; background: #F4F1FD; color: #4C2FB5; font-size: 9.5px; font-weight: 700;
            letter-spacing: 0.5px; padding: 4px 10px; border-radius: 4px; border: 1px solid #E8DFFF;
            font-family: "Poppins", sans-serif;
          }
          .doc-title { font-size: 20px; font-weight: 700; margin-top: 6px; font-family: "Poppins", sans-serif; }
          .doc-number { font-size: 11px; color: #667085; margin-top: 2px; }
          .divider { height: 3px; background: #4C2FB5; margin: 16px 0; border-radius: 2px; }
          .summary-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px 20px; margin-bottom: 18px; }
          .summary-label {
            font-size: 9px; font-weight: 700; color: #888; letter-spacing: 0.4px; margin-bottom: 3px;
            text-transform: uppercase;
          }
          .summary-value { font-size: 12.5px; font-weight: 600; }
          .pill {
            display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 700;
            background: #FFF7EC; color: #B54708; border: 1px solid #FEDF89;
          }
          .customer-box { background: #F4F1FD; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; }
          .customer-title {
            font-size: 10.5px; font-weight: 700; color: #4C2FB5; letter-spacing: 0.5px; margin-bottom: 8px;
            text-transform: uppercase; font-family: "Poppins", sans-serif;
          }
          .customer-grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px 20px; }
          table.items { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 18px; }
          table.items thead tr { background: #1F2937; color: #fff; }
          table.items th {
            text-align: left; font-size: 9.5px; letter-spacing: 0.4px; padding: 8px 10px; text-transform: uppercase;
            font-family: "Poppins", sans-serif;
          }
          table.items th.num, table.items td.num { text-align: right; }
          table.items td { padding: 9px 10px; font-size: 11.5px; border-bottom: 1px solid #EAECF0; vertical-align: top; }
          .closing { display: flex; justify-content: flex-end; }
          .totals { width: 320px; flex-shrink: 0; }
          .totals-line { display: flex; justify-content: space-between; font-size: 12px; color: #444; padding: 3px 0; }
          .totals-line b { color: #101828; font-weight: 600; }
          .total-main {
            display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #1F2937;
            margin-top: 8px; padding-top: 10px;
          }
          .total-main .label { font-size: 15px; font-weight: 700; font-family: "Poppins", sans-serif; }
          .total-main .value { font-size: 22px; font-weight: 700; font-family: "Poppins", sans-serif; }
          .legend {
            border: 1px dashed #F79009; border-radius: 4px; background: #FFF7EC; color: #B54708;
            font-size: 9.5px; padding: 8px 10px; margin-top: 14px; text-align: center;
          }
          .footer { text-align: center; font-size: 9.5px; color: #888; margin-top: 22px; line-height: 1.6; }
          @media print {
            .sheet { padding: 0; }
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>

      <body>
        <div class="sheet">
          <div class="head-row">
            <div class="company">
              <div class="logo-box">${escapeHtml(initials(companyName))}</div>
              <div>
                <div class="company-name">${escapeHtml(companyName)}</div>
                <div class="company-meta">${escapeHtml(companyMeta || "—")}</div>
              </div>
            </div>
            <div class="doc-info">
              <span class="doc-badge">TIPO 07 · NOTA DE CRÉDITO</span>
              <div class="doc-title">Nota de Crédito Electrónica</div>
              <div class="doc-number">N° ${escapeHtml(nota.num)}</div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="summary-row">
            <div>
              <div class="summary-label">Estado</div>
              <span class="pill">Vista previa · no enviada a SUNAT</span>
            </div>
            <div>
              <div class="summary-label">Fecha de emisión</div>
              <div class="summary-value">${escapeHtml(nota.fecha)}</div>
            </div>
            <div>
              <div class="summary-label">Moneda</div>
              <div class="summary-value">Soles (PEN)</div>
            </div>
          </div>

          <div class="customer-box">
            <div class="customer-title">Documento que modifica y motivo</div>
            <div class="customer-grid">
              <div>
                <div class="summary-label">Cliente</div>
                <div class="summary-value">${escapeHtml(nota.cliente)}</div>
              </div>
              <div>
                <div class="summary-label">Comprobante que modifica</div>
                <div class="summary-value">${escapeHtml(documentoModificado)}</div>
              </div>
              <div>
                <div class="summary-label">Motivo (catálogo SUNAT 09)</div>
                <div class="summary-value">${escapeHtml(formatMotivoNota(nota))}</div>
              </div>
            </div>
          </div>

          <table class="items">
            <colgroup>
              <col style="width:8%"><col style="width:44%"><col style="width:12%"><col style="width:18%"><col style="width:18%">
            </colgroup>
            <thead>
              <tr>
                <th>N°</th>
                <th>Descripción</th>
                <th class="num">Cant.</th>
                <th class="num">P. Unit. (con IGV)</th>
                <th class="num">Importe</th>
              </tr>
            </thead>
            <tbody>${itemRows}
            </tbody>
          </table>

          <div class="closing">
            <div class="totals">
              <div class="totals-line"><span>Op. gravada (subtotal)</span><b>${escapeHtml(money(montos.subtotal))}</b></div>
              <div class="totals-line"><span>IGV</span><b>${escapeHtml(money(montos.igv))}</b></div>
              <div class="total-main"><span class="label">Total</span><span class="value">${escapeHtml(money(montos.total))}</span></div>
            </div>
          </div>

          <div class="legend">
            Documento generado por Powip. Esta nota de crédito aún no se envía ni se guarda en SUNAT.
            No tiene validez tributaria: es solo una vista previa de prueba.
          </div>

          <div class="footer">
            Representación impresa de la Nota de Crédito · Powip · Generado el ${escapeHtml(new Date().toLocaleString("es-PE"))}
          </div>
        </div>
      </body>
    </html>
  `;
}

export function imprimirNotaCreditoPdf(nota: Nota, issuer?: NotaIssuer): void {
  if (!issuer) {
    toast.error(
      "Agrega un RUC emisor en la pestaña Emisores (RUC) para imprimir la nota de crédito",
    );
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    toast.error("Habilita las ventanas emergentes para imprimir la nota de crédito");
    return;
  }

  printWindow.document.write(buildNotaCreditoHtml(nota, issuer));
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 400);
}
