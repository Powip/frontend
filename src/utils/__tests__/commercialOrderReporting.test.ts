import { isCommercialSale } from "../commercialOrderReporting";
import {
  soloEntregados,
  enTransito,
  paidAmount,
} from "@/app/administracion/_lib/realData";
import { mapOrderToFunnelBucket } from "@/services/cierreDiaProductosService";
it("excludes explicit Leads while preserving legacy NULL and classified sales", () => {
  expect(isCommercialSale({ commercialStage: "LEAD" })).toBe(false);
  expect(isCommercialSale({ commercialStage: "SALE" })).toBe(true);
  expect(isCommercialSale({ commercialStage: null })).toBe(true);
  expect(isCommercialSale({})).toBe(true);
});
it("does not count a paid/delivered Lead in delivered sales or transit receivables, preserving its payment", () => {
  const lead = {
    commercialStage: "LEAD",
    status: "ENTREGADO",
    payments: [{ status: "PAID", amount: 100 }],
  };
  expect(soloEntregados([lead, { status: "ENTREGADO" }])).toHaveLength(1);
  expect(enTransito([{ ...lead, status: "EN_ENVIO" }])).toHaveLength(0);
  expect(paidAmount(lead)).toBe(100);
});
it("does not infer commercial confirmation from imported operative status or a scheduled callback", () => {
  expect(
    mapOrderToFunnelBucket({
      commercialStage: "LEAD",
      status: "PREPARADO",
      subEstadoCc: "confirmado",
    }),
  ).toBe("porConfirmar");
  expect(
    mapOrderToFunnelBucket({
      commercialStage: "SALE",
      status: "PENDIENTE",
      subEstadoCc: "por_confirmar",
    }),
  ).toBe("confirmado");
  expect(
    mapOrderToFunnelBucket({ status: "PREPARADO", subEstadoCc: null }),
  ).toBe("confirmado");
});
