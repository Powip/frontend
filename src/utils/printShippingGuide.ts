import { format } from "date-fns";
import { toast } from "sonner";
import { generateBarcode } from "./printOrderLabel";
import { GUIDE_STATUS_LABEL, ZONE_LABELS } from "@/constants/operationsDomain";
import type { OrderDetail, ShippingGuide } from "@/components/modals/GuideDetailsModal";

export interface PrintGuideCompany {
  name?: string;
  cuit?: string;
  billingAddress?: string;
  phone?: string;
  logoUrl?: string;
}

type PrintableGuide = Pick<
  ShippingGuide,
  "guideNumber" | "courierName" | "deliveryZones" | "status" | "created_at"
>;

/**
 * Guía de salida — documento de despacho A4 para el courier, distinto de
 * "Imprimir etiqueta de envío" (rótulo por paquete). Extraído de
 * GuideDetailsModal.tsx para poder invocarlo también desde el modal de éxito
 * de "Enviar a Shalom" (SendToShalomModal.tsx) sin duplicar la plantilla.
 *
 * Separa los pedidos en PREPAGO/PAGADO vs POR COBRAR según su saldo
 * pendiente real (payments con status PAID/PENDING_APPROVAL), no un campo
 * inventado. El total de cobranza a rendir es la suma de esos saldos
 * pendientes reales — no depende de ningún estado externo del caller.
 */
export function printShippingGuide(
  guide: PrintableGuide,
  ordersDetails: OrderDetail[],
  company?: PrintGuideCompany | null,
): void {
  const companyName = company?.name || "MI EMPRESA";
  const companyCuit = company?.cuit || "";
  const companyAddress = company?.billingAddress || "";
  const companyPhone = company?.phone || "";
  const companyInitial = companyName.trim().charAt(0).toUpperCase() || "?";

  const zonasLabel =
    (guide.deliveryZones ?? []).map((z) => ZONE_LABELS[z] ?? z).join(" · ") ||
    "-";
  const statusLabel =
    GUIDE_STATUS_LABEL[guide.status as keyof typeof GUIDE_STATUS_LABEL] ??
    guide.status;
  const fecha = format(new Date(guide.created_at), "dd/MM/yyyy");
  const hora = format(new Date(guide.created_at), "HH:mm");

  const rows = ordersDetails.map((order) => {
    const paid =
      order.payments
        ?.filter((p) => p.status === "PAID")
        .reduce((s, p) => s + Number(p.amount), 0) || 0;
    const pendingApproval =
      order.payments
        ?.filter((p) => p.status === "PENDING_APPROVAL")
        .reduce((s, p) => s + Number(p.amount), 0) || 0;
    const total = Number(order.totals?.grandTotal ?? order.grandTotal ?? 0);
    const pending = Math.max(total - paid - pendingApproval, 0);
    // Sin displayValue: el N° de pedido ya se ve en texto arriba del
    // código — repetirlo bajo las barras solo suma línea por fila, y con
    // guías de 50+ pedidos eso empuja el documento a varias páginas extra.
    const barcode = generateBarcode(order.orderNumber, {
      width: 1.3,
      height: 16,
      margin: 3,
      displayValue: false,
    });
    const contenido =
      order.items
        ?.map((it) => `<span class="q">${it.quantity}×</span> ${it.productName}`)
        .join("<br/>") || "-";
    return { order, pending, barcode, contenido };
  });

  const prepagoRows = rows.filter((r) => r.pending <= 0);
  const codRows = rows.filter((r) => r.pending > 0);
  const codTotal = codRows.reduce((s, r) => s + r.pending, 0);

  const renderRow = (r: (typeof rows)[number], index: number) => `
    <tr>
      <td class="idx">${index + 1}</td>
      <td class="ord">
        <b>${r.order.orderNumber}</b>
        ${r.barcode ? `<span class="bc"><img src="${r.barcode}" alt="Código de barras"></span>` : ""}
      </td>
      <td class="who">
        <b>${r.order.customer.fullName}</b>
        <span>${r.order.customer.phoneNumber || "-"}</span>
        <span>DNI ${r.order.customer.dni || "—"}</span>
      </td>
      <td class="addr">
        <span class="dist">${r.order.customer.district || "-"}</span><br/>
        ${r.order.customer.address || "-"}
      </td>
      <td class="cont">${r.contenido}</td>
      <td class="r">
        ${
          r.pending > 0
            ? `<span class="cobrar-cod">S/ ${r.pending.toFixed(2)}</span>`
            : `<span class="cobrar-pre">PREPAGO</span><br/><span class="mono" style="font-weight:700">S/ 0.00</span>`
        }
      </td>
    </tr>
  `;

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Guía de salida — ${guide.guideNumber}</title>
      <style>
        :root{
          --ink:#000000;
          --powip:#4F46E5; --cod:#B45309; --cod-bg:#FDF4E7; --pre:#0F766E; --pre-bg:#E7F5F2;
        }
        *{box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
        body{font-family:Arial, sans-serif; color:var(--ink); padding:9mm; font-size:2.6mm;}
        .mono{font-variant-numeric:tabular-nums;}

        .head{display:flex; justify-content:space-between; align-items:flex-start; gap:8mm; padding-bottom:3mm; border-bottom:2.2px solid var(--ink);}
        .biz{display:flex; gap:3mm; align-items:flex-start;}
        .biz .logo{width:11mm;height:11mm;border:1.8px solid var(--ink);border-radius:2.4mm;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:6.5mm;flex-shrink:0;}
        .biz h1{font-size:4.4mm; font-weight:800; letter-spacing:-.02em; line-height:1.05;}
        .biz p{font-size:2.5mm; color:var(--ink); font-weight:700; line-height:1.3; margin-top:.6mm;}
        .biz p b{font-weight:800;}
        .doc{text-align:right; flex-shrink:0;}
        .doc .kicker{font-size:2.3mm; letter-spacing:.18em; font-weight:800; color:var(--ink); text-transform:uppercase;}
        .doc .no{font-size:6mm; font-weight:900; letter-spacing:-.02em; line-height:1; margin-top:.5mm;}
        .doc .row{display:flex; gap:5mm; justify-content:flex-end; margin-top:1.6mm;}
        .doc .row .k{font-size:2mm; letter-spacing:.08em; text-transform:uppercase; font-weight:800;}
        .doc .row .v{font-size:2.8mm; font-weight:800; margin-top:.2mm;}
        .badge{display:inline-flex; align-items:center; gap:1.2mm; font-size:2.5mm; font-weight:800; letter-spacing:.03em;
          padding:1mm 2.6mm; border-radius:20px; background:var(--pre-bg); color:var(--pre); margin-top:1.8mm; text-transform:uppercase;}

        .meta{display:grid; grid-template-columns:repeat(5,1fr); border:1.4px solid var(--ink); border-radius:1.6mm; overflow:hidden; margin-top:3.2mm;}
        .meta > div{padding:1.8mm 2.6mm; border-right:1.4px solid var(--ink);}
        .meta > div:last-child{border-right:none; background:#000; color:#fff;}
        .meta .k{font-size:2mm; letter-spacing:.1em; text-transform:uppercase; font-weight:800;}
        .meta .v{font-size:3.6mm; font-weight:900; letter-spacing:-.02em; margin-top:.6mm; line-height:1.05;}
        .meta .v.sm{font-size:2.9mm; line-height:1.15;}

        .section{margin-top:3.2mm;}
        .sec-h{display:flex; align-items:center; gap:2mm; padding:1.4mm 2.6mm; border-radius:1.6mm 1.6mm 0 0; color:#fff;}
        .sec-h.pre{background:var(--pre);}
        .sec-h.cod{background:var(--cod);}
        .sec-h .ic{width:4.4mm;height:4.4mm;border-radius:1mm;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:2.5mm;font-weight:900;}
        .sec-h h2{font-size:2.9mm; font-weight:800; letter-spacing:.01em;}
        .sec-h .desc{font-size:2.3mm; font-weight:700;}
        .sec-h .count{margin-left:auto; font-size:2.4mm; font-weight:800; background:rgba(255,255,255,.28); padding:.8mm 2.2mm; border-radius:20px; white-space:nowrap;}

        table{width:100%; border-collapse:collapse; font-size:2.4mm;}
        thead th{background:#fff; text-align:left; font-size:1.9mm; letter-spacing:.06em; text-transform:uppercase; color:var(--ink);
          font-weight:800; padding:1.2mm 2mm; border-bottom:1.4px solid var(--ink); border-top:1.4px solid var(--ink);}
        thead tr:first-child th{border-top:none;}
        th.r, td.r{text-align:right;}
        tbody td{padding:1.3mm 2mm; border-bottom:1px solid var(--ink); vertical-align:top;}
        .idx{font-weight:800; font-size:2.4mm;}
        .ord b{font-size:2.5mm; font-weight:800; letter-spacing:-.01em; display:block;}
        .ord .bc{display:block; margin-top:.6mm;}
        .ord .bc img{max-width:26mm; height:4mm; display:block;}
        .who b{font-weight:800; font-size:2.5mm; display:block;}
        .who span{display:block; font-weight:700; margin-top:.2mm; font-size:2.3mm;}
        .addr{font-weight:700; line-height:1.2; font-size:2.3mm;}
        .addr .dist{font-weight:800;}
        .cont{font-weight:700; line-height:1.25; font-size:2.3mm;}
        .cont .q{font-weight:800;}
        .cobrar-pre{font-weight:800; color:var(--pre); font-size:2.3mm;}
        .cobrar-cod{font-weight:900; color:var(--cod); font-size:2.9mm;}

        .empty{padding:3.2mm; text-align:center; font-weight:700; font-size:2.5mm; border:1.2px dashed var(--ink); border-top:none; border-radius:0 0 1.6mm 1.6mm;}

        .box{border:1.4px solid var(--ink); border-radius:1.6mm; overflow:hidden; margin-top:3.2mm;}
        .box .bh{padding:1.4mm 2.6mm; background:#fff; font-size:2mm; letter-spacing:.08em; text-transform:uppercase; font-weight:800; border-bottom:1.4px solid var(--ink);}
        .box .bb{padding:2.4mm;}
        .tline{display:flex; justify-content:space-between; align-items:center; padding:1.2mm 0; border-bottom:1px dashed var(--ink); font-size:2.6mm;}
        .tline:last-child{border-bottom:none;}
        .tline span{font-weight:700;}
        .tline b{font-weight:800;}
        .tline.total{border-top:1.4px solid var(--ink); margin-top:.8mm; padding-top:1.8mm;}
        .tline.total span{font-weight:800; font-size:2.8mm;}
        .tline.total b{font-size:4mm; font-weight:900; letter-spacing:-.02em;}

        .firmas{display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin-top:5mm;}
        .firma{border:1.4px solid var(--ink); border-radius:1.6mm; padding:2.4mm; }
        .firma .k{font-size:2mm; letter-spacing:.06em; text-transform:uppercase; font-weight:800;}
        .firma .sign{height:12mm; border-bottom:1.2px solid var(--ink); margin:1.6mm 0;}
        .firma .f{display:flex; justify-content:space-between; font-size:2.1mm; font-weight:700;}

        .obs{margin-top:3.2mm; border:1.4px solid var(--ink); border-radius:1.6mm; padding:2.4mm; min-height:10mm;}
        .obs .k{font-size:2mm; letter-spacing:.06em; text-transform:uppercase; font-weight:800; margin-bottom:1mm;}
        .obs .lines{background-image:repeating-linear-gradient(#000 0 1px, transparent 1px 6mm); height:9mm; opacity:.35;}

        .foot{margin-top:4mm; padding-top:2.4mm; display:flex; align-items:center; gap:3mm; border-top:1.4px solid var(--ink);}
        .foot .pw{display:flex; align-items:center; gap:1.6mm; font-weight:800; font-size:2.6mm;}
        .foot .pw .m{width:4.4mm;height:4.4mm;border-radius:1mm;background:var(--powip);color:#fff;display:flex;align-items:center;justify-content:center;font-size:2.6mm;}
        .foot .u{font-weight:700; font-size:2.3mm;}
        .foot .r{margin-left:auto; font-size:2.2mm; font-weight:700;}

        @page{ size:A4; margin:8mm; }
        @media print{
          .section, .box, .firmas, .obs{break-inside:avoid;}
          tr{break-inside:avoid;}
        }
      </style>
    </head>
    <body>

      <div class="head">
        <div class="biz">
          <div class="logo">${
            company?.logoUrl
              ? `<img src="${company.logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:2.4mm;">`
              : companyInitial
          }</div>
          <div>
            <h1>${companyName}</h1>
            <p>${
              [companyCuit ? `<b>RUC ${companyCuit}</b>` : "", companyAddress]
                .filter(Boolean)
                .join(" · ")
            }${companyPhone ? `<br/>${companyPhone}` : ""}</p>
          </div>
        </div>
        <div class="doc">
          <div class="kicker">Guía de salida</div>
          <div class="no">${guide.guideNumber}</div>
          <div class="row">
            <div><div class="k">Fecha</div><div class="v">${fecha}</div></div>
            <div><div class="k">Despacho</div><div class="v mono">${hora}</div></div>
          </div>
          <div class="badge">${statusLabel}</div>
        </div>
      </div>

      <div class="meta">
        <div><div class="k">Zona</div><div class="v sm">${zonasLabel}</div></div>
        <div><div class="k">Courier</div><div class="v sm">${guide.courierName || "-"}</div></div>
        <div><div class="k">Pedidos</div><div class="v">${ordersDetails.length}</div></div>
        <div><div class="k">Paquetes</div><div class="v">${ordersDetails.length}</div></div>
        <div><div class="k">Cobranza total</div><div class="v mono">S/ ${codTotal.toFixed(2)}</div></div>
      </div>

      <div class="section">
        <div class="sec-h pre">
          <span class="ic">✓</span>
          <div><h2>PREPAGO / PAGADO</h2></div>
          <span class="desc">El courier NO cobra en la entrega</span>
          <span class="count">${prepagoRows.length} pedido${prepagoRows.length === 1 ? "" : "s"} · S/ 0.00 a cobrar</span>
        </div>
        ${
          prepagoRows.length === 0
            ? `<div class="empty">Sin pedidos prepago en esta guía.</div>`
            : `<table>
                <thead>
                  <tr>
                    <th style="width:6mm">#</th>
                    <th style="width:40mm">Pedido</th>
                    <th>Destinatario</th>
                    <th>Dirección</th>
                    <th>Contenido</th>
                    <th class="r" style="width:26mm">A cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  ${prepagoRows.map((r, i) => renderRow(r, i)).join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="section">
        <div class="sec-h cod">
          <span class="ic">S/</span>
          <div><h2>POR COBRAR / CONTRAENTREGA</h2></div>
          <span class="desc">El courier cobra el monto al entregar</span>
          <span class="count">${codRows.length} pedido${codRows.length === 1 ? "" : "s"} · S/ ${codTotal.toFixed(2)} a cobrar</span>
        </div>
        ${
          codRows.length === 0
            ? `<div class="empty">Sin pedidos por cobrar en esta guía — todos los pedidos van prepago.</div>`
            : `<table>
                <thead>
                  <tr>
                    <th style="width:6mm">#</th>
                    <th style="width:40mm">Pedido</th>
                    <th>Destinatario</th>
                    <th>Dirección</th>
                    <th>Contenido</th>
                    <th class="r" style="width:26mm">A cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  ${codRows.map((r, i) => renderRow(r, i)).join("")}
                </tbody>
              </table>`
        }
      </div>

      <div class="box">
        <div class="bh">Resumen de la guía</div>
        <div class="bb">
          <div class="tline"><span>Pedidos · Paquetes</span><b class="mono">${ordersDetails.length} · ${ordersDetails.length}</b></div>
          <div class="tline"><span>Pedidos prepago</span><b class="mono">${prepagoRows.length}</b></div>
          <div class="tline"><span>Pedidos por cobrar</span><b class="mono">${codRows.length}</b></div>
          <div class="tline total"><span>Cobranza a rendir</span><b class="mono">S/ ${codTotal.toFixed(2)}</b></div>
        </div>
      </div>

      <div class="firmas">
        <div class="firma">
          <div class="k">Despachado por (negocio)</div>
          <div class="sign"></div>
          <div class="f"><span>Nombre / DNI</span><b>&nbsp;</b></div>
        </div>
        <div class="firma">
          <div class="k">Recibido por (courier)</div>
          <div class="sign"></div>
          <div class="f"><span>Nombre / DNI</span><b>&nbsp;</b></div>
        </div>
        <div class="firma">
          <div class="k">V°B° Operaciones</div>
          <div class="sign"></div>
          <div class="f"><span>Nombre / DNI</span><b>&nbsp;</b></div>
        </div>
      </div>

      <div class="obs">
        <div class="k">Observaciones</div>
        <div class="lines"></div>
      </div>

      <div class="foot">
        <div class="pw"><span class="m">◆</span> Generado por POWIP</div>
        <div class="u">Operaciones › Guías &amp; Courier · powip.lat</div>
        <div class="r">Impreso ${format(new Date(), "dd/MM/yyyy")} · Página 1 de 1</div>
      </div>

    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } else {
    toast.error(
      "No se pudo abrir la ventana de impresión — revisa el bloqueador de pop-ups del navegador",
    );
  }
}
