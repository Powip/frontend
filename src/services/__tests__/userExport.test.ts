/**
 * @jest-environment node
 */
import ExcelJS from "exceljs";
import type { User } from "@/interfaces/IUser";
import { buildUserExportRow, buildUsersWorkbook, usersExportFileName } from "../userExport";

const user = (overrides: Partial<User> = {}): User => ({
  id: "u1",
  identityDocument: "01234567",
  name: "Ana",
  surname: "Torres",
  email: "ana@empresa.com",
  phoneNumber: "+51 987654321",
  address: "Jr. Iquique 807",
  district: "Breña",
  province: "Lima",
  city: "Lima",
  status: true,
  role: { id: "r-ventas", name: "VENTAS" },
  ...overrides,
});

const reread = async (users: User[]) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildUsersWorkbook(users).xlsx.writeBuffer());
  const sheet = workbook.getWorksheet("Usuarios");
  if (!sheet) throw new Error("sin hoja Usuarios");
  return sheet;
};

describe("buildUserExportRow", () => {
  it("no presenta el email como login y no altera los datos", () => {
    expect(buildUserExportRow(user())).toEqual({
      login: "",
      name: "Ana",
      surname: "Torres",
      address: "Jr. Iquique 807",
      district: "Breña",
      province: "Lima",
      department: "Lima",
      email: "ana@empresa.com",
      identityDocument: "01234567",
      role: "VENTAS",
      status: "Activo",
      phoneNumber: "+51 987654321",
    });
  });

  it("usa el username cuando existe y marca sin rol e inactivo", () => {
    const row = buildUserExportRow(user({ username: "ana.t", role: null, status: false }));

    expect(row.login).toBe("ana.t");
    expect(row.role).toBe("Sin rol");
    expect(row.status).toBe("Inactivo");
  });
});

describe("buildUsersWorkbook", () => {
  it("genera encabezados y una fila por usuario en el orden recibido", async () => {
    const sheet = await reread([user(), user({ id: "u2", name: "Luis", identityDocument: "00012345" })]);

    expect(sheet.getRow(1).values).toEqual([
      undefined,
      "Usuario",
      "Nombre",
      "Apellidos",
      "Dirección",
      "Distrito",
      "Provincia",
      "Departamento",
      "Email",
      "Documento",
      "Rol",
      "Estado",
      "Teléfono",
    ]);
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(3).getCell(2).value).toBe("Luis");
    expect(sheet.getRow(3).getCell(9).value).toBe("00012345");
  });

  it("conserva el teléfono +51 tal cual, como texto y sin apóstrofo", async () => {
    const cell = (await reread([user()])).getRow(2).getCell(12);

    expect(cell.value).toBe("+51 987654321");
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(cell.numFmt).toBe("@");
  });

  it.each(["=SUM(A1:A2)", "=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"])(
    "guarda %j como texto, no como fórmula",
    async (value) => {
      const cell = (await reread([user({ name: value })])).getRow(2).getCell(2);

      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.value).toBe(value);
      expect(cell.formula).toBeUndefined();
    },
  );

  it("nombra el archivo con la fecha", () => {
    expect(usersExportFileName(new Date(2026, 9, 7))).toBe("usuarios_2026-10-07.xlsx");
  });
});
