import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import type { User } from "@/interfaces/IUser";

const TEXT_FORMAT = "@";

const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "Usuario", key: "login", width: 22 },
  { header: "Nombre", key: "name", width: 20 },
  { header: "Apellidos", key: "surname", width: 22 },
  { header: "Dirección", key: "address", width: 32 },
  { header: "Distrito", key: "district", width: 18 },
  { header: "Provincia", key: "province", width: 18 },
  { header: "Departamento", key: "department", width: 18 },
  { header: "Email", key: "email", width: 30 },
  { header: "Documento", key: "identityDocument", width: 16 },
  { header: "Rol", key: "role", width: 18 },
  { header: "Estado", key: "status", width: 10 },
  { header: "Teléfono", key: "phoneNumber", width: 16 },
].map((column) => ({ ...column, style: { numFmt: TEXT_FORMAT } }));

export function buildUserExportRow(user: User) {
  return {
    login: user.username?.trim() ?? "",
    name: user.name ?? "",
    surname: user.surname ?? "",
    address: user.address ?? "",
    district: user.district ?? "",
    province: user.province ?? "",
    department: user.department || user.city || "",
    email: user.email ?? "",
    identityDocument: user.identityDocument ?? "",
    role: user.role?.name?.trim() || "Sin rol",
    status: user.status === true ? "Activo" : "Inactivo",
    phoneNumber: user.phoneNumber ?? "",
  };
}

export function buildUsersWorkbook(users: User[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Usuarios", { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = COLUMNS;

  for (const user of users) {
    const row = worksheet.addRow([]);
    for (const [key, value] of Object.entries(buildUserExportRow(user))) {
      const cell = row.getCell(key);
      cell.value = value;
      cell.numFmt = TEXT_FORMAT;
    }
  }

  const header = worksheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EEFF" } };
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + users.length, column: COLUMNS.length } };
  return workbook;
}

export const usersExportFileName = (date = new Date()) => `usuarios_${format(date, "yyyy-MM-dd")}.xlsx`;

export async function exportUsersToExcel(users: User[]): Promise<void> {
  const buffer = await buildUsersWorkbook(users).xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    usersExportFileName(),
  );
}
