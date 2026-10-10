import type { AdminPartnerReferral } from "../models/admin-partner-referral";

export const ADMIN_PARTNER_REFERRALS_MOCK: Record<string, AdminPartnerReferral[]> = {
  "partner-maria-torres": [
    { id: "apr-1", businessName: "Café Norte", origin: "link", registeredAt: "2026-08-12", planName: "Standard", price: 189, billingCycle: "mensual", status: "activo_sin_pago", firstMonthCommission: null, recurringCommission: null },
    { id: "apr-2", businessName: "Glow Skincare", origin: "link", registeredAt: "2026-08-05", planName: "Full", price: 269, billingCycle: "mensual", status: "pagando", firstMonthCommission: 121.05, recurringCommission: 21.52 },
    { id: "apr-3", businessName: "Pet House", origin: "codigo", registeredAt: "2026-07-28", planName: "Standard", price: 189, billingCycle: "mensual", status: "pagando", firstMonthCommission: 85.05, recurringCommission: 15.12 },
    { id: "apr-4", businessName: "Bazar Lima", origin: "link", registeredAt: "2026-07-20", planName: "Standard", price: 189, billingCycle: "mensual", status: "cancelado", firstMonthCommission: -85.05, recurringCommission: 0 },
    { id: "apr-5", businessName: "Kids Wear", origin: "link", registeredAt: "2026-07-14", planName: "Full", price: 269, billingCycle: "mensual", status: "pagando", firstMonthCommission: 121.05, recurringCommission: 21.52 },
    { id: "apr-6", businessName: "Tech Gadgets", origin: "codigo", registeredAt: "2026-07-02", planName: "Standard", price: 189, billingCycle: "mensual", status: "pagando", firstMonthCommission: 85.05, recurringCommission: 15.12 },
    { id: "apr-7", businessName: "Boutique Sol", origin: "link", registeredAt: "2026-08-15", planName: null, price: 0, billingCycle: null, status: "en_revision", firstMonthCommission: null, recurringCommission: null },
    { id: "apr-8", businessName: "Moda Fit", origin: "link", registeredAt: "2026-06-10", planName: "Basic", price: 99, billingCycle: "mensual", status: "cancelado", firstMonthCommission: -44.55, recurringCommission: 0 },
    { id: "apr-9", businessName: "Aroma Café", origin: "link", registeredAt: "2026-06-01", planName: "Full", price: 269, billingCycle: "anual", status: "pagando", firstMonthCommission: 121.05, recurringCommission: 21.52 },
  ],
  "partner-joel-coila": [
    { id: "apr-10", businessName: "Livii Moda SAC", origin: "link", registeredAt: "2026-08-02", planName: "Standard", price: 189, billingCycle: "mensual", status: "pagando", firstMonthCommission: 68.04, recurringCommission: 11.34 },
    { id: "apr-11", businessName: "TechPeru Store", origin: "codigo", registeredAt: "2026-08-07", planName: "Full", price: 269, billingCycle: "mensual", status: "pagando", firstMonthCommission: 96.84, recurringCommission: 16.14 },
    { id: "apr-12", businessName: "Kunca Deco", origin: "manual", registeredAt: "2026-08-05", planName: "Standard", price: 189, billingCycle: "mensual", status: "activo_sin_pago", firstMonthCommission: null, recurringCommission: null },
    { id: "apr-13", businessName: "Distribuidora Sur", origin: "manual", registeredAt: "2026-08-10", planName: "Full", price: 1999, billingCycle: "anual", status: "pagando", firstMonthCommission: 719.64, recurringCommission: 119.94 },
    { id: "apr-14", businessName: "Zapatería Andes", origin: "link", registeredAt: "2026-08-09", planName: null, price: 0, billingCycle: null, status: "en_revision", firstMonthCommission: null, recurringCommission: null },
    { id: "apr-15", businessName: "Moda Urbana EIRL", origin: "manual", registeredAt: "2026-08-14", planName: "Basic", price: 99, billingCycle: "mensual", status: "cancelado", firstMonthCommission: -35.64, recurringCommission: 0 },
  ],
  "partner-dev-studio-lima": [
    { id: "apr-16", businessName: "Tienda Gamer", origin: "manual", registeredAt: "2026-08-14", planName: "Standard", price: 189, billingCycle: "mensual", status: "en_revision", firstMonthCommission: null, recurringCommission: null },
    { id: "apr-17", businessName: "Server Parts", origin: "manual", registeredAt: "2026-07-01", planName: "Full", price: 269, billingCycle: "mensual", status: "pagando", firstMonthCommission: 169.47, recurringCommission: 8.07 },
    { id: "apr-18", businessName: "CodeShop", origin: "codigo", registeredAt: "2026-06-20", planName: "Standard", price: 189, billingCycle: "mensual", status: "cancelado", firstMonthCommission: -119.07, recurringCommission: 0 },
  ],
};

export function getAdminPartnerReferralsFromMock(partnerId: string): AdminPartnerReferral[] {
  return ADMIN_PARTNER_REFERRALS_MOCK[partnerId] ?? [];
}
