import {
  canSeeWhatsAppTab,
  hasRouteAccess,
  isAccessGatedRoute,
  SUPERADMIN_EMAILS,
} from "../permissions.config";

const JOEL = "joel@aranni.com.pe";
const demo = { email: "demo@tienda.pe", role: "ADMINISTRADOR", permissions: [] };

describe("Pestaña de WhatsApp: solo joel@aranni.com.pe", () => {
  it("sin variable solo entra Joel, sin importar mayúsculas ni espacios", () => {
    expect(canSeeWhatsAppTab(JOEL, undefined)).toBe(true);
    expect(canSeeWhatsAppTab(" Joel@Aranni.com.pe ", "")).toBe(true);
    expect(canSeeWhatsAppTab("demo@tienda.pe", undefined)).toBe(false);
    expect(canSeeWhatsAppTab(undefined, undefined)).toBe(false);
  });

  it("la variable cambia la lista y «*» la abre a todos", () => {
    expect(canSeeWhatsAppTab("demo@tienda.pe", "demo@tienda.pe, joel@aranni.com.pe")).toBe(true);
    expect(canSeeWhatsAppTab(JOEL, "demo@tienda.pe")).toBe(false);
    expect(canSeeWhatsAppTab("otro@tienda.pe", "*")).toBe(true);
  });

  it.each(["/configuracion/whatsapp", "/configuracion/whatsapp/ajustes"])(
    "cierra %s a un administrador y a los demás superadmins",
    (route) => {
      expect(hasRouteAccess(route, demo)).toBe(false);
      expect(hasRouteAccess(route, undefined)).toBe(false);
      for (const email of SUPERADMIN_EMAILS.filter((item) => item !== JOEL)) {
        expect(hasRouteAccess(route, { email })).toBe(false);
      }
      expect(hasRouteAccess(route, { email: JOEL })).toBe(true);
    },
  );

  it("no cierra el resto de Configuración y el menú oculta el enlace", () => {
    expect(hasRouteAccess("/configuracion", demo)).toBe(true);
    expect(hasRouteAccess("/configuracion/integraciones", demo)).toBe(true);
    expect(isAccessGatedRoute("/configuracion/whatsapp")).toBe(true);
    expect(isAccessGatedRoute("/configuracion")).toBe(false);
  });
});
