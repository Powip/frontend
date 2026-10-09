import { isWhatsAppContractAvailable, WHATSAPP_CONTRACTS } from "../constants/whatsapp-contracts";
import { WHATSAPP_TAB_DEFINITIONS } from "../constants/whatsapp-tabs";
import { WHATSAPP_CONTRACT_STATUSES } from "../enums/whatsapp.enums";
import { whatsappKeys } from "../keys/whatsapp.keys";
import { resolveWhatsAppAccess } from "../utils/whatsapp-access.util";

describe("registro de contratos", () => {
  it("los catálogos existentes quedan confirmados y disponibles", () => {
    for (const key of [
      "companyStores",
      "companyCouriers",
      "companySalesChannels",
      "customerServiceAgents",
      "orderEvidence",
      "orderCustomerServiceAgent",
      "legacyTrackingLink",
    ] as const) {
      expect(WHATSAPP_CONTRACTS[key].status).toBe(WHATSAPP_CONTRACT_STATUSES.CONFIRMED);
      expect(WHATSAPP_CONTRACTS[key].evidence).toMatch(/^src\//);
      expect(isWhatsAppContractAvailable(key)).toBe(true);
    }
  });

  it("ningún contrato del módulo WhatsApp está disponible todavía", () => {
    const whatsappContracts = new Set(WHATSAPP_TAB_DEFINITIONS.flatMap((tab) => tab.contracts));
    for (const key of whatsappContracts) {
      expect(WHATSAPP_CONTRACTS[key].status).not.toBe(WHATSAPP_CONTRACT_STATUSES.CONFIRMED);
      expect(isWhatsAppContractAvailable(key)).toBe(false);
    }
    expect(isWhatsAppContractAvailable("serviceBaseUrl")).toBe(false);
  });

  it("cada pestaña declara secciones y dependencias", () => {
    expect(WHATSAPP_TAB_DEFINITIONS.map((tab) => tab.key)).toEqual([
      "conexion",
      "plantillas",
      "programacion",
      "conversaciones",
      "historial",
      "ajustes",
    ]);
    for (const tab of WHATSAPP_TAB_DEFINITIONS) {
      expect(tab.sections.length).toBeGreaterThan(0);
      expect(tab.contracts.length).toBeGreaterThan(0);
    }
  });
});

describe("query keys", () => {
  it("separan por empresa y tienda", () => {
    expect(whatsappKeys.rules("empresa-1", "tienda-1")).toEqual([
      "whatsapp",
      "company",
      "empresa-1",
      "store",
      "tienda-1",
      "rules",
    ]);
    expect(whatsappKeys.threads("empresa-1", { storeId: null })).not.toEqual(
      whatsappKeys.threads("empresa-2", { storeId: null }),
    );
  });
});

describe("resolveWhatsAppAccess", () => {
  it("solo administradores y superadmins gestionan la configuración", () => {
    expect(resolveWhatsAppAccess({ role: "ADMINISTRADOR" }).canManageConfiguration).toBe(true);
    expect(resolveWhatsAppAccess({ role: "AGENTES" }).canManageConfiguration).toBe(false);
    expect(resolveWhatsAppAccess({ role: "VENTAS" }).canManageConfiguration).toBe(false);
    expect(
      resolveWhatsAppAccess({ role: "VENTAS", email: "tognolimauricio@gmail.com" })
        .canManageConfiguration,
    ).toBe(true);
  });

  it("no deduce roles de Gestión CC", () => {
    expect(resolveWhatsAppAccess({ role: "AGENTES" }).customerServiceRolesPending).toBe(true);
  });
});
