import axiosAuth from "@/lib/axiosAuth";
import {
  createMaterial,
  createObjection,
  createSheet,
  deleteMaterial,
  deleteObjection,
  deleteSheet,
  getObjectionStats,
  getScript,
  getScriptReads,
  listMaterials,
  listObjections,
  listSheets,
  markScriptRead,
  registerObjectionUse,
  saveScript,
  updateMaterial,
  updateObjection,
  updateSheet,
} from "../crmContentService";
import { updateConversation } from "../crmService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const http = axiosAuth as unknown as Record<"get" | "post" | "put" | "patch" | "delete", jest.Mock>;
const B = "http://localhost:3012/crm";

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockResolvedValue({ data: { items: [] } });
  http.post.mockResolvedValue({ data: {} });
  http.put.mockResolvedValue({ data: {} });
  http.patch.mockResolvedValue({ data: {} });
  http.delete.mockResolvedValue({ data: {} });
});

describe("crmContentService · guion", () => {
  it("lee, guarda (PUT) y marca leído", async () => {
    await getScript();
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/script`);
    const input = { steps: [{ name: "Saludo", message: "Hola {nombre}", question: "¿Qué buscas?" }], note: "Nuevo" };
    await saveScript(input);
    expect(http.put).toHaveBeenCalledWith(`${B}/content/script`, input);
    await markScriptRead();
    expect(http.post).toHaveBeenCalledWith(`${B}/content/script/read`);
    await getScriptReads();
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/script/reads`);
  });

  it("el paso del chat usa PATCH /conversations/:id", async () => {
    await updateConversation("c1", { scriptStep: 2 });
    expect(http.patch).toHaveBeenCalledWith(`${B}/conversations/c1`, { scriptStep: 2 });
  });
});

describe("crmContentService · objeciones", () => {
  it("CRUD, uso y estadísticas", async () => {
    http.get.mockResolvedValueOnce({ data: { items: [{ id: "o1" }] } });
    expect(await listObjections()).toEqual([{ id: "o1" }]);
    await createObjection({ name: "Caro", response: "Vale la pena" });
    expect(http.post).toHaveBeenLastCalledWith(`${B}/content/objections`, { name: "Caro", response: "Vale la pena" });
    await updateObjection("o 1", { active: false, position: 2 });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/content/objections/o%201`, { active: false, position: 2 });
    await deleteObjection("o1");
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/content/objections/o1`);
    await registerObjectionUse("c1", "o1");
    expect(http.post).toHaveBeenLastCalledWith(`${B}/conversations/c1/objections`, { objectionId: "o1" });
    await getObjectionStats();
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/objections/stats`, { params: { days: 30 } });
    await getObjectionStats(7);
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/objections/stats`, { params: { days: 7 } });
  });
});

describe("crmContentService · fichas y material", () => {
  it("listSheets manda search solo si hay texto", async () => {
    await listSheets("  ");
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/sheets`, { params: undefined });
    await listSheets(" polo ");
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/sheets`, { params: { search: "polo" } });
  });

  it("CRUD de fichas", async () => {
    await createSheet({ name: "Polo", price: "S/ 50" });
    expect(http.post).toHaveBeenLastCalledWith(`${B}/content/sheets`, { name: "Polo", price: "S/ 50" });
    await updateSheet("s1", { active: false });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/content/sheets/s1`, { active: false });
    await deleteSheet("s1");
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/content/sheets/s1`);
  });

  it("material: lista por sheetId (general), crea, edita y borra", async () => {
    await listMaterials("general");
    expect(http.get).toHaveBeenLastCalledWith(`${B}/content/materials`, { params: { sheetId: "general" } });
    await createMaterial({ sheetId: "s1", kind: "photo", title: "Foto", url: "https://x.pe/a.jpg" });
    expect(http.post).toHaveBeenLastCalledWith(`${B}/content/materials`, {
      sheetId: "s1",
      kind: "photo",
      title: "Foto",
      url: "https://x.pe/a.jpg",
    });
    await updateMaterial("m1", { position: 0 });
    expect(http.patch).toHaveBeenLastCalledWith(`${B}/content/materials/m1`, { position: 0 });
    await deleteMaterial("m1");
    expect(http.delete).toHaveBeenLastCalledWith(`${B}/content/materials/m1`);
  });
});
