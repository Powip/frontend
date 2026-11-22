import type { ShalomAgencyOption } from "@/services/shalomService";
import { agencyLocationKey, filterAgenciesByLocation, hasAgencyLocation } from "../shalomAgencyLocation";

const agency = (nombre: string, departamento: string, provincia: string, direccion = ""): ShalomAgencyOption => ({
  id_agencia: nombre, nombre_agencia: nombre, api_name: `${nombre} API`, direccion, ter_aereo: 0, departamento, provincia,
});
const catalog = [
  agency("MIRAFLORES OVALO", "LIMA", "LIMA", "Av. Ficticia 100"),
  agency("SURCO CHACARILLA", "LIMA", "LIMA", "Calle Ficticia 200 - Miraflores"),
  agency("BREÑA CENTRO", "LIMA", "LIMA", "Jr. Ficticio 300"),
  agency("HUACHO PLAZA", "LIMA", "HUAURA", "Av. Ficticia 400"),
  agency("CUSCO WANCHAQ", "CUSCO", "CUSCO", "Av. Ficticia 500"),
  agency("SAN MARTIN TARAPOTO", "SAN MARTIN", "SAN MARTIN", "Jr. Ficticio 600"),
  agency("BOLIVAR CENTRO", "LA LIBERTAD", "BOLIVAR", "Jr. Ficticio 700"),
  agency("MIRAFLORES AREQUIPA", "AREQUIPA", "AREQUIPA", "Av. Ficticia 800"),
];
const names = (location: Parameters<typeof filterAgenciesByLocation>[1]) => {
  const result = filterAgenciesByLocation(catalog, location);
  return { level: result.level, names: result.agencies.map((a) => a.nombre_agencia) };
};

describe("filterAgenciesByLocation", () => {
  it("primero las agencias del mismo distrito, dentro de la provincia del cliente", () => {
    expect(names({ department: "Lima", province: "Lima", district: "Miraflores" })).toEqual({
      level: "district", names: ["MIRAFLORES OVALO", "SURCO CHACARILLA"],
    });
  });

  it("compara sin tildes ni mayúsculas, también con ñ", () => {
    expect(names({ department: "LIMA", province: "lima", district: "breña" })).toEqual({ level: "district", names: ["BREÑA CENTRO"] });
    expect(names({ department: "Lima", province: "Lima", district: "BRENA" })).toEqual({ level: "district", names: ["BREÑA CENTRO"] });
    expect(names({ department: "San Martín", province: "San Martín", district: "Tarapoto" })).toEqual({
      level: "district", names: ["SAN MARTIN TARAPOTO"],
    });
  });

  it("el distrito cuenta como palabra completa, no como parte de otra", () => {
    expect(names({ department: "Lima", province: "Lima", district: "Surco" }).names).toEqual(["SURCO CHACARILLA"]);
    expect(names({ department: "Lima", province: "Lima", district: "Sur" }).level).toBe("province");
  });

  it("sin agencias en el distrito muestra las de la misma provincia", () => {
    expect(names({ department: "Lima", province: "Lima", district: "San Borja" })).toEqual({
      level: "province", names: ["MIRAFLORES OVALO", "SURCO CHACARILLA", "BREÑA CENTRO"],
    });
  });

  it("sin agencias en la provincia muestra las del departamento", () => {
    expect(names({ department: "Lima", province: "Cañete", district: "Asia" })).toEqual({
      level: "department", names: ["MIRAFLORES OVALO", "SURCO CHACARILLA", "BREÑA CENTRO", "HUACHO PLAZA"],
    });
  });

  it("no mezcla provincias del mismo nombre de otro departamento", () => {
    expect(names({ department: "La Libertad", province: "Bolívar", district: "Uchumarca" })).toEqual({
      level: "province", names: ["BOLIVAR CENTRO"],
    });
    expect(names({ department: "Cajamarca", province: "San Martín", district: "X" }).level).toBe("none");
  });

  it("un distrito con el mismo nombre en otra provincia no cuenta", () => {
    expect(names({ department: "Arequipa", province: "Arequipa", district: "Miraflores" })).toEqual({
      level: "district", names: ["MIRAFLORES AREQUIPA"],
    });
  });

  it("solo con departamento o solo con provincia filtra por lo que haya", () => {
    expect(names({ department: "Cusco" })).toEqual({ level: "department", names: ["CUSCO WANCHAQ"] });
    expect(names({ province: "Huaura" })).toEqual({ level: "province", names: ["HUACHO PLAZA"] });
    expect(names({ district: "Miraflores" })).toEqual({
      level: "district", names: ["MIRAFLORES OVALO", "SURCO CHACARILLA", "MIRAFLORES AREQUIPA"],
    });
  });

  it("sin coincidencias o sin ubicación no devuelve agencias (nivel none)", () => {
    expect(names({ department: "Tacna", province: "Tacna", district: "Tacna" })).toEqual({ level: "none", names: [] });
    expect(names({})).toEqual({ level: "none", names: [] });
    expect(names(null)).toEqual({ level: "none", names: [] });
  });
});

describe("ubicación del cliente", () => {
  it("hay ubicación si viene cualquiera de sus partes", () => {
    expect(hasAgencyLocation({ district: "Miraflores" })).toBe(true);
    expect(hasAgencyLocation({ department: " ", province: "", district: null })).toBe(false);
    expect(hasAgencyLocation(undefined)).toBe(false);
  });
  it("la clave no cambia por tildes, mayúsculas ni espacios", () => {
    expect(agencyLocationKey({ department: "San Martín", province: " LIMA ", district: "Breña" }))
      .toBe(agencyLocationKey({ department: "san martin", province: "Lima", district: "BRENA" }));
    expect(agencyLocationKey({ department: "Lima", province: "Lima", district: "Surco" }))
      .not.toBe(agencyLocationKey({ department: "Lima", province: "Lima", district: "Miraflores" }));
  });
});
