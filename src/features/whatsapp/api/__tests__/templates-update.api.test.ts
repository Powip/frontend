import axiosAuth from "@/lib/axiosAuth";
import { updateWhatsAppTemplate } from "../templates.api";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { put: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));

const put = jest.mocked(axiosAuth.put);

describe("updateWhatsAppTemplate", () => {
  it("edita por id con PUT y manda solo categoría y componentes", async () => {
    put.mockResolvedValue({ data: { data: { id: "tpl-1", status: "PENDING" } } });
    const components = [{ type: "BODY", text: "Hola {{1}}" }];

    const result = await updateWhatsAppTemplate("tpl-1", { category: "UTILITY", components });

    expect(put).toHaveBeenCalledWith("http://int/whatsapp/templates/tpl-1", {
      category: "UTILITY",
      components,
    });
    expect(result).toMatchObject({ id: "tpl-1", status: "PENDING" });
  });
});
