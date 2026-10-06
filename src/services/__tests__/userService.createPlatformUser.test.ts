import axios from "axios";
import { createPlatformUser } from "../userService";

jest.mock("axios");
const mockedPost = axios.post as jest.Mock;

const REQUEST = {
  identityDocument: "12345678",
  name: "Ana",
  surname: "Torres",
  email: "ana@empresa.com",
  password: "clave123",
  address: "Av. Siempre Viva 123",
  department: "Lima",
  province: "Lima",
  district: "Ate",
  phoneNumber: "912345678",
  roleName: "ADMINISTRADOR",
};

describe("createPlatformUser", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockedPost.mockReset();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("con contraseña inválida no expone ningún fragmento en el error ni en el log", async () => {
    const password = "Secreta";

    const error = await createPlatformUser({ ...REQUEST, password }, "jwt").catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "La contraseña no cumple el formato requerido (mín. 6 chars, una minúscula, un número)",
    );
    expect((error as Error).message).not.toContain(password.slice(0, 4));
    const logged = consoleError.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(password.slice(0, 4));
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("con contraseña válida mantiene el payload y la normalización de userId", async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: "u-1" } });

    await expect(createPlatformUser(REQUEST, "jwt")).resolves.toEqual({ id: "u-1", userId: "u-1" });
    expect(mockedPost.mock.calls[0][0]).toMatch(/\/api\/v1\/auth\/admin\/register$/);
    expect(mockedPost.mock.calls[0][1]).toEqual({
      identityDocument: "12345678",
      name: "Ana",
      surname: "Torres",
      email: "ana@empresa.com",
      password: "clave123",
      address: "Av. Siempre Viva 123",
      city: "Lima",
      province: "Lima",
      district: "Ate",
      phoneNumber: "912345678",
      role: { name: "ADMINISTRADOR" },
    });
    expect(mockedPost.mock.calls[0][2]).toEqual({
      headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
    });
  });

  it.each([
    ["message", { message: "Valor rechazado: clave123" }],
    ["errors como texto", { errors: ["password clave123 inválida"] }],
    ["cuerpo sin message ni errors en arreglo", { errors: { password: { rejectedValue: "clave123" } } }],
  ])("oculta la contraseña si el backend la devuelve (%s)", async (_, data) => {
    mockedPost.mockRejectedValueOnce({ response: { data }, message: "Request failed with status code 400" });

    const error = await createPlatformUser(REQUEST, "jwt").catch((e: Error) => e);

    expect((error as Error).message).toMatch(/^ms-auth 400: /);
    expect((error as Error).message).not.toContain("clave123");
    expect((error as Error).message).toContain("[oculto]");
  });

  it("oculta también la forma escapada en JSON de una contraseña con comillas y barras", async () => {
    const password = 'cla"ve\\123';
    mockedPost.mockRejectedValueOnce({ response: { data: { errors: { password: { rejectedValue: password } } } } });

    const error = await createPlatformUser({ ...REQUEST, password }, "jwt").catch((e: Error) => e);

    expect((error as Error).message).not.toContain(JSON.stringify(password).slice(1, -1));
    expect((error as Error).message).not.toContain(password);
    expect((error as Error).message).toContain("[oculto]");
  });

  it("conserva el mensaje del backend cuando no incluye la contraseña", async () => {
    mockedPost.mockRejectedValueOnce({ response: { data: { message: "El email ya existe" } } });

    await expect(createPlatformUser(REQUEST, "jwt")).rejects.toThrow("ms-auth 400: El email ya existe");
  });
});
