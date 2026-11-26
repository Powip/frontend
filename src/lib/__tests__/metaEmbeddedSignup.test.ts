import {
  EmbeddedSignupCancelledError,
  SIMULATED_EMBEDDED_SIGNUP_CODE,
  launchEmbeddedSignup,
  parseEmbeddedSignupMessage,
  resetFacebookSdkForTests,
} from "@/lib/metaEmbeddedSignup";

const base = { appId: "123", configId: "cfg", apiVersion: "v26.0", simulated: false };

afterEach(() => {
  delete window.FB;
  resetFacebookSdkForTests();
});

describe("parseEmbeddedSignupMessage", () => {
  it("lee waba_id y phone_number_id del evento FINISH de facebook.com", () => {
    const data = JSON.stringify({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH",
      data: { waba_id: "w1", phone_number_id: "p1" },
    });
    expect(parseEmbeddedSignupMessage("https://www.facebook.com", data)).toEqual({
      wabaId: "w1",
      phoneNumberId: "p1",
    });
  });

  it("ignora otros orígenes, otros tipos y eventos sin terminar", () => {
    const ok = { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "w" } };
    expect(parseEmbeddedSignupMessage("https://evil.com", ok)).toBeNull();
    expect(parseEmbeddedSignupMessage("https://facebook.com.evil.com", ok)).toBeNull();
    expect(parseEmbeddedSignupMessage("https://www.facebook.com", { type: "OTHER" })).toBeNull();
    expect(
      parseEmbeddedSignupMessage("https://www.facebook.com", { ...ok, event: "CANCEL" }),
    ).toBeNull();
    expect(parseEmbeddedSignupMessage("https://www.facebook.com", "no-json")).toBeNull();
  });
});

describe("launchEmbeddedSignup", () => {
  it("en modo simulador no carga Meta y devuelve el código fijo", async () => {
    await expect(launchEmbeddedSignup({ ...base, simulated: true })).resolves.toEqual({
      code: SIMULATED_EMBEDDED_SIGNUP_CODE,
    });
    expect(document.getElementById("facebook-jssdk")).toBeNull();
  });

  it("sin appId o configId falla con mensaje claro", async () => {
    await expect(launchEmbeddedSignup({ ...base, configId: null })).rejects.toThrow(
      /Falta configurar la app de Meta/,
    );
  });

  it("abre FB.login con la configuración y junta los ids del mensaje", async () => {
    const login = jest.fn((cb: (r: unknown) => void) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.facebook.com",
          data: JSON.stringify({
            type: "WA_EMBEDDED_SIGNUP",
            event: "FINISH",
            data: { waba_id: "w9", phone_number_id: "p9" },
          }),
        }),
      );
      cb({ authResponse: { code: "CODE-1" } });
    });
    const init = jest.fn();
    window.FB = { init, login } as never;
    await expect(launchEmbeddedSignup(base)).resolves.toEqual({
      code: "CODE-1",
      wabaId: "w9",
      phoneNumberId: "p9",
    });
    expect(init).toHaveBeenCalledWith(expect.objectContaining({ appId: "123", version: "v26.0" }));
    expect(login.mock.calls[0][1]).toMatchObject({
      config_id: "cfg",
      response_type: "code",
      override_default_response_type: true,
    });
  });

  it("si la persona cierra la ventana lanza EmbeddedSignupCancelledError", async () => {
    window.FB = { init: jest.fn(), login: (cb: (r: unknown) => void) => cb({ authResponse: null }) } as never;
    await expect(launchEmbeddedSignup(base)).rejects.toBeInstanceOf(EmbeddedSignupCancelledError);
  });
});
