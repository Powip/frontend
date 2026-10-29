import { AxiosError } from "axios";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { loginErrorMessage, registrationErrorMessage } from "../authErrors";

describe("loginErrorMessage", () => {
  it.each([401, 403])("oculta detalles de credenciales y cuentas para HTTP %s", (status) => {
    const missingAccount = loginErrorMessage(
      buildAxiosError(status, { message: "Usuario no encontrado con email: private@example.com" }),
    );
    const wrongPassword = loginErrorMessage(
      buildAxiosError(status, { message: "La contraseña es incorrecta" }),
    );
    expect(missingAccount).toBe(
      "El correo o la contraseña son incorrectos. Revisa tus datos e intenta nuevamente.",
    );
    expect(wrongPassword).toBe(missingAccount);
    expect(missingAccount).not.toContain("private@example.com");
  });

  it.each([
    "Bad credentials",
    "Invalid credentials",
    "Usuario no encontrado",
    "Usuario no encontrado con email: private@example.com",
    "Este correo no existe",
    "Email not registered",
    "User account is disabled",
    "La contraseña es incorrecta",
  ])("normaliza la excepción Spring 400 '%s' sin enumerar cuentas", (message) => {
    expect(loginErrorMessage(buildAxiosError(400, { error: message }))).toBe(
      loginErrorMessage(buildAxiosError(401)),
    );
  });

  it("traduce el mapa de validación real de LoginRequest.java", () => {
    expect(
      loginErrorMessage(
        buildAxiosError(400, {
          email: "Email invalido",
          password: "Contraseña es obligatorio",
        }),
      ),
    ).toBe("Ingresa un correo electrónico válido. Ingresa tu contraseña.");
  });

  it("presenta requisitos legibles de contraseña en lugar del texto raw", () => {
    expect(
      loginErrorMessage(
        buildAxiosError(400, {
          password:
            "La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número",
        }),
      ),
    ).toBe("La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.");
  });

  it("traduce y deduplica arrays sin convertirlos en texto técnico", () => {
    expect(
      loginErrorMessage(
        buildAxiosError(400, {
          message: [
            "email must be an email",
            "email must be an email",
            "password should not be empty",
            { defaultMessage: "java.lang.IllegalArgumentException: internal detail" },
          ],
        }),
      ),
    ).toBe("Ingresa un correo electrónico válido. Ingresa tu contraseña.");
  });

  it("prioriza la respuesta privada si un array también revela una cuenta", () => {
    expect(
      loginErrorMessage(
        buildAxiosError(400, { message: ["Email invalido", "Usuario no encontrado"] }),
      ),
    ).toBe(loginErrorMessage(buildAxiosError(401)));
  });

  it.each([
    "Bad Request",
    "SQL constraint failed at auth.users",
    "<html>nginx upstream unavailable</html>",
    "Error en /api/v1/auth/login: bearer private-token",
    "Un mensaje de servidor no reconocido",
  ])("no muestra mensajes 400 no reconocidos: %s", (message) => {
    expect(loginErrorMessage(buildAxiosError(400, { message }))).toBe(
      "Revisa tu correo y contraseña e intenta nuevamente.",
    );
  });

  it("indica cuándo reintentar por demasiados intentos", () => {
    expect(loginErrorMessage(buildAxiosError(429, { message: "Too Many Requests" }))).toBe(
      "Demasiados intentos. Espera unos minutos e intenta nuevamente.",
    );
  });

  it.each(["ECONNABORTED", "ETIMEDOUT"])("distingue timeout %s de credenciales", (code) => {
    expect(loginErrorMessage(new AxiosError("timeout of 10000ms exceeded", code))).toBe(
      "La solicitud tardó demasiado. Intenta nuevamente.",
    );
  });

  it("distingue fallos de conexión y no expone el host", () => {
    expect(loginErrorMessage(buildAxiosError())).toBe(
      "No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.",
    );
    expect(
      loginErrorMessage({ request: {}, message: "Failed connecting to private.internal" }),
    ).toBe("No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.");
  });

  it.each([500, 502, 503, 504])("trata HTTP %s como error temporal del servicio", (status) => {
    expect(
      loginErrorMessage(
        buildAxiosError(status, { message: "NullPointerException", detail: "secret" }),
      ),
    ).toBe("No pudimos iniciar sesión en este momento. Intenta nuevamente en unos minutos.");
  });

  it.each([null, undefined, "secret", {}, new Error("private implementation detail")])(
    "usa una respuesta genérica para un error desconocido",
    (error) => {
      expect(loginErrorMessage(error)).toBe("No pudimos iniciar sesión. Intenta nuevamente.");
    },
  );

  it("tolera payloads cíclicos sin bloquear el formulario", () => {
    const payload: { errors?: unknown } = {};
    payload.errors = payload;
    expect(loginErrorMessage(buildAxiosError(400, payload))).toBe(
      "Revisa tu correo y contraseña e intenta nuevamente.",
    );
  });
});

describe("registrationErrorMessage", () => {
  it.each([
    [409, { code: "EMAIL_ALREADY_EXISTS" }],
    [400, { message: 'User with email "private@example.com" already exists' }],
    [400, { error: "El correo electrónico ya existe." }],
    [400, { errorCode: "EMAIL_ALREADY_EXISTS" }],
  ])("conserva la guía de email duplicado HTTP %s sin mostrar datos raw", (status, payload) => {
    expect(registrationErrorMessage(buildAxiosError(status, payload))).toBe(
      "Este email ya está registrado. Inicia sesión para continuar con tu suscripción.",
    );
  });

  it("conserva documento duplicado sin atribuirlo al email", () => {
    expect(
      registrationErrorMessage(buildAxiosError(409, { code: "IDENTITY_DOCUMENT_ALREADY_EXISTS" })),
    ).toBe("El documento de identidad ya está registrado. Revisa tus datos o contacta a soporte.");
  });

  it("conserva la guía genérica para un conflicto con datos no identificados", () => {
    expect(registrationErrorMessage(buildAxiosError(409, { message: "private detail" }))).toBe(
      "Estos datos ya están registrados. Si ya tienes una cuenta, inicia sesión para continuar.",
    );
  });

  it.each([
    { message: ["El teléfono debe tener 9 dígitos", "La dirección es obligatoria"] },
    {
      errors: [
        { defaultMessage: "El teléfono debe tener 9 dígitos" },
        { message: "La dirección es obligatoria" },
      ],
      error: "Bad Request",
    },
  ])("conserva las validaciones conocidas de arrays (%j)", (payload) => {
    expect(registrationErrorMessage(buildAxiosError(400, payload))).toBe(
      "El teléfono debe tener 9 dígitos. La dirección es obligatoria",
    );
  });

  it("traduce el mapa real de RegisterRequest.java con copy fijo", () => {
    expect(
      registrationErrorMessage(
        buildAxiosError(400, {
          email: "Email invalido.",
          password: "Password es obligatorio",
          name: "Nombre es obligatorio",
          surname: "Surname es obligatorio",
          phoneNumber: "Phone number es obligatorio",
          identityDocument: "Numero de documento es obligatorio.",
          address: "Address es obligatorio",
          district: "District es obligatorio",
        }),
      ),
    ).toBe(
      "Ingresa un correo electrónico válido. Ingresa tu contraseña. El nombre es obligatorio. El apellido es obligatorio. El teléfono es obligatorio. El documento de identidad es obligatorio. La dirección es obligatoria. El distrito es obligatorio",
    );
  });

  it("deduplica validaciones y descarta detalles técnicos en un array mixto", () => {
    expect(
      registrationErrorMessage(
        buildAxiosError(400, {
          errors: [
            "El teléfono debe tener 9 dígitos",
            "El teléfono debe tener 9 dígitos",
            "SQL exception at private.auth.example with private-token",
          ],
        }),
      ),
    ).toBe("El teléfono debe tener 9 dígitos");
  });

  it.each([
    "SQL exception on private.auth.users",
    "<html>Bad gateway</html>",
    "Bearer private-token failed at private.auth.example",
    "Mensaje no reconocido",
  ])("oculta validaciones desconocidas o técnicas: %s", (message) => {
    expect(registrationErrorMessage(buildAxiosError(400, { message }))).toBe(
      "Datos inválidos. Revisa los campos e intenta nuevamente.",
    );
  });

  it("separa el límite de intentos de otros fallos", () => {
    expect(registrationErrorMessage(buildAxiosError(429, { error: "internal rate bucket" }))).toBe(
      "Demasiados intentos. Espera unos minutos e intenta nuevamente.",
    );
  });

  it.each(["ECONNABORTED", "ETIMEDOUT"])("explica el timeout %s sin texto técnico", (code) => {
    expect(registrationErrorMessage(new AxiosError("private timeout detail", code))).toBe(
      "La solicitud tardó demasiado. Intenta nuevamente.",
    );
  });

  it("explica conexión sin filtrar el host", () => {
    expect(registrationErrorMessage(buildAxiosError())).toBe(
      "No pudimos conectarnos. Revisa tu conexión e intenta nuevamente.",
    );
  });

  it.each([500, 502, 503, 504])("oculta mensaje y detalle HTTP %s", (status) => {
    expect(
      registrationErrorMessage(
        buildAxiosError(status, { error: "SQL secret", detail: "internal host" }),
      ),
    ).toBe("No pudimos crear tu cuenta en este momento. Intenta nuevamente en unos minutos.");
  });

  it("usa copy seguro para errores desconocidos", () => {
    expect(registrationErrorMessage(new Error("secret"))).toBe(
      "No pudimos crear tu cuenta. Intenta nuevamente.",
    );
  });
});
