import { toast } from "sonner";
import {
  type Almacen,
  ESTADOS_GUIA,
  type Guia,
  MODALIDAD_TRANSPORTE,
  MOTIVOS_TRASLADO,
} from "@/types/facturacion";

export interface GuiaIssuer {
  ruc: string;
  razonSocial: string;
  direccion?: string;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Iniciales del emisor para el recuadro del logo (como en la boleta). */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "G"
  );
}

/**
 * Abre una representación imprimible de la guía de remisión con el mismo
 * layout que la boleta: encabezado con emisor a la izquierda y documento a la
 * derecha, fila de estado/fecha/pedido, bloque gris de destinatario, tabla
 * de bultos, datos de traslado y totales a la derecha, y leyenda inferior.
 *
 * Colores conservados de la guía (morado y gris): sin cambios de paleta.
 * Sin código QR.
 *
 * Las guías todavía son mock local: el documento lo dice explícitamente para
 * no confundirlo con una GRE aceptada por SUNAT.
 */
export function imprimirGuiaPdf(guia: Guia, almacen?: Almacen, issuer?: GuiaIssuer): void {
  if (!issuer) {
    toast.error("Selecciona un emisor (RUC) antes de imprimir la guía");
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    toast.error("Habilita las ventanas emergentes para imprimir la guía");
    return;
  }

  const motivo = MOTIVOS_TRASLADO.find((item) => item.code === guia.motivo);
  const modalidad = MODALIDAD_TRANSPORTE.find((item) => item.code === guia.modalidad);
  const estado = ESTADOS_GUIA[guia.estado];

  const fullNumber = guia.fullNumber || "Sin número";

  const motivoLabel = motivo ? `${motivo.code} — ${motivo.label}` : guia.motivo;
  const modalidadLabel = modalidad?.label || guia.modalidad;
  const estadoLabel = estado.label;

  const transporte =
    guia.modalidad === "01"
      ? `Transportista: ${guia.transportista || "—"} | RUC: ${guia.transportistaRuc || "—"}`
      : `Placa: ${guia.placa || "—"} | Licencia: ${guia.licencia || "—"}`;

  const companyName = issuer?.razonSocial || "—";
  const companyMeta = [issuer?.ruc ? `RUC ${issuer.ruc}` : null, issuer?.direccion || null]
    .filter(Boolean)
    .join(" · ");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Guía de Remisión ${escapeHtml(fullNumber)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <style>
          @page { size: A4; margin: 12mm 10mm; }

          * { box-sizing: border-box; }

          /* Mismas fuentes que la boleta: Montserrat en el texto, Poppins en títulos. */
          body {
            font-family: "Montserrat", -apple-system, sans-serif;
            color: #101828;
            font-size: 11px;
            margin: 0;
            line-height: 1.4;
          }

          .sheet { width: 100%; max-width: 800px; margin: 0 auto; padding: 16px 20px 24px; }

          /* ---------- Encabezado (igual a la boleta) ---------- */
          .head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
          .company { display: flex; gap: 14px; align-items: center; }
          .logo-box {
            width: 56px; height: 56px; border-radius: 10px; background: #6D4FE0; color: #fff;
            display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700;
            flex-shrink: 0; font-family: "Poppins", sans-serif;
          }
          .company-name { font-size: 20px; font-weight: 700; color: #101828; font-family: "Poppins", sans-serif; }
          .company-meta { font-size: 10.5px; color: #667085; margin-top: 3px; }

          .doc-info { text-align: right; }
          .doc-badge {
            display: inline-block; background: #F4F1FD; color: #6D4FE0; font-size: 9.5px; font-weight: 700;
            letter-spacing: 0.5px; padding: 4px 10px; border-radius: 4px; border: 1px solid #E8DFFF;
            font-family: "Poppins", sans-serif;
          }
          .doc-title { font-size: 20px; font-weight: 700; margin-top: 6px; color: #101828; font-family: "Poppins", sans-serif; }
          .doc-number { font-size: 11px; color: #667085; margin-top: 2px; }

          .divider { height: 3px; background: #6D4FE0; margin: 16px 0; border-radius: 2px; }

          /* ---------- Fila de estado, fecha y pedido ---------- */
          .summary-row {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px 20px; margin-bottom: 18px;
          }
          .summary-label {
            font-size: 9px; font-weight: 700; color: #888; letter-spacing: 0.4px; margin-bottom: 3px;
            text-transform: uppercase;
          }
          .summary-value { font-size: 12.5px; font-weight: 600; color: #101828; }
          .pill {
            display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 700;
            background: #F4F1FD; color: #6D4FE0; border: 1px solid #E8DFFF;
          }

          /* ---------- Bloque de destinatario (gris de la guía) ---------- */
          .customer-box { background: #F4F1FD; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; }
          .customer-title {
            font-size: 10.5px; font-weight: 700; color: #6D4FE0; letter-spacing: 0.5px; margin-bottom: 8px;
            text-transform: uppercase; font-family: "Poppins", sans-serif;
          }
          .customer-grid { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px 20px; }

          /* ---------- Tabla de bultos (igual a la boleta) ---------- */
          table.items { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 18px; }
          table.items thead tr { background: #1F2937; color: #fff; }
          table.items th {
            text-align: left; font-size: 9.5px; letter-spacing: 0.4px; padding: 8px 10px; text-transform: uppercase;
            font-family: "Poppins", sans-serif;
          }
          table.items th.num, table.items td.num { text-align: right; }
          table.items td {
            padding: 9px 10px; font-size: 11.5px; border-bottom: 1px solid #EAECF0; vertical-align: top;
          }

          /* ---------- Traslado (izquierda) y totales (derecha) ---------- */
          .closing { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
          .traslado { flex: 1; font-size: 11px; }
          .traslado .row { margin-bottom: 8px; }
          .traslado .label {
            font-size: 9px; font-weight: 700; color: #888; letter-spacing: 0.4px; text-transform: uppercase;
            margin-bottom: 2px;
          }
          .traslado .value { font-size: 11px; color: #101828; }

          .totals { width: 320px; flex-shrink: 0; }
          .totals-line { display: flex; justify-content: space-between; font-size: 12px; color: #444; padding: 3px 0; }
          .totals-line b { color: #101828; font-weight: 600; }
          .total-main {
            display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #1F2937;
            margin-top: 8px; padding-top: 10px;
          }
          .total-main .label { font-size: 15px; font-weight: 700; font-family: "Poppins", sans-serif; }
          .total-main .value { font-size: 22px; font-weight: 700; font-family: "Poppins", sans-serif; }

          /* ---------- Leyendas y pie (igual a la boleta) ---------- */
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
          <!-- Encabezado: emisor a la izquierda, documento a la derecha -->
          <div class="head-row">
            <div class="company">
              <div class="logo-box">${escapeHtml(initials(companyName))}</div>
              <div>
                <div class="company-name">${escapeHtml(companyName)}</div>
                <div class="company-meta">${escapeHtml(companyMeta || "—")}</div>
              </div>
            </div>
            <div class="doc-info">
              <span class="doc-badge">REMITENTE · GUÍA DE REMISIÓN</span>
              <div class="doc-title">Guía de Remisión Electrónica</div>
              <div class="doc-number">N° ${escapeHtml(fullNumber)}</div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Estado, fecha y pedido -->
          <div class="summary-row">
            <div>
              <div class="summary-label">Estado</div>
              <span class="pill">${escapeHtml(estadoLabel)}</span>
            </div>
            <div>
              <div class="summary-label">Fecha de emisión</div>
              <div class="summary-value">${escapeHtml(guia.fecha)}</div>
            </div>
            <div>
              <div class="summary-label">Pedido</div>
              <div class="summary-value">${escapeHtml(guia.pedido)}</div>
            </div>
          </div>

          <!-- Destinatario -->
          <div class="customer-box">
            <div class="customer-title">Datos del destinatario</div>
            <div class="customer-grid">
              <div>
                <div class="summary-label">Nombre</div>
                <div class="summary-value">${escapeHtml(guia.cliente)}</div>
              </div>
              <div>
                <div class="summary-label">Dirección de destino</div>
                <div class="summary-value">${escapeHtml(guia.destino)}</div>
              </div>
            </div>
          </div>

          <!-- Bultos / mercadería -->
          <table class="items">
            <colgroup>
              <col style="width:8%"><col style="width:44%"><col style="width:16%"><col style="width:16%"><col style="width:16%">
            </colgroup>
            <thead>
              <tr>
                <th>N°</th>
                <th>Descripción</th>
                <th class="num">Bultos</th>
                <th class="num">Peso bruto (kg)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>01</td>
                <td><b>Mercadería amparada por pedido ${escapeHtml(guia.pedido)}</b></td>
                <td class="num">${escapeHtml(guia.bultos)}</td>
                <td class="num">${escapeHtml(guia.peso)}</td>
                <td>${escapeHtml(estadoLabel)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Traslado a la izquierda; totales a la derecha -->
          <div class="closing">
            <div class="traslado">
              <div class="row">
                <div class="label">Motivo de traslado</div>
                <div class="value">${escapeHtml(motivoLabel)}</div>
              </div>
              <div class="row">
                <div class="label">Modalidad de transporte</div>
                <div class="value">${escapeHtml(modalidadLabel)}</div>
                <div class="value">${escapeHtml(transporte)}</div>
              </div>
              <div class="row">
                <div class="label">Punto de partida</div>
                <div class="value">${escapeHtml(almacen?.nombre || "—")} · ${escapeHtml(almacen?.direccion || "—")}</div>
              </div>
              <div class="row">
                <div class="label">Documento relacionado</div>
                <div class="value">${escapeHtml(guia.docRelacionado || "—")}</div>
              </div>
            </div>

            <div class="totals">
              <div class="totals-line"><span>Bultos</span><b>${escapeHtml(guia.bultos)}</b></div>
              <div class="totals-line"><span>Peso bruto total</span><b>${escapeHtml(guia.peso)} kg</b></div>
              <div class="total-main"><span class="label">Total</span><span class="value">${escapeHtml(guia.bultos)} bultos</span></div>
            </div>
          </div>

          ${
            guia.estado === "RECHAZADA" && guia.cdrDesc
              ? `<div class="legend" style="border-color:#F04438;background:#FDF3F2;color:#B42318">
                 Guía rechazada por SUNAT (${escapeHtml(guia.cdrCode)}): ${escapeHtml(guia.cdrDesc)}
               </div>`
              : ""
          }

          <div class="legend">
            Documento generado por Powip. Esta guía aún no se envía ni se guarda en SUNAT.
            Válida solo como vista previa de prueba local.
          </div>

          <div class="footer">
            Representación impresa de la Guía de Remisión · Powip · Generado el ${escapeHtml(new Date().toLocaleString("es-PE"))}
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 400);
}
