import axiosAuth from "@/lib/axiosAuth";
import { resolveOrderNumbers } from "@/services/orderNumbersService";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn() } }));
const post = jest.mocked(axiosAuth.post);

describe("resolveOrderNumbers (FEAT-24 H0)", () => {
  beforeEach(() => post.mockReset());

  it("pide en lotes de 200 y junta los resultados", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    post.mockResolvedValueOnce({ data: { numbers: { [ids[0]]: "ORD-1" } } }).mockResolvedValueOnce({ data: { numbers: { [ids[249]]: "ORD-250" } } });
    await expect(resolveOrderNumbers(ids)).resolves.toEqual({ [ids[0]]: "ORD-1", [ids[249]]: "ORD-250" });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toMatch(/\/order-header\/numbers$/);
    expect((post.mock.calls[0][1] as { ids: string[] }).ids).toHaveLength(200);
  });

  it("sin ids no llama y ante error devuelve vacío", async () => {
    await expect(resolveOrderNumbers([])).resolves.toEqual({});
    expect(post).not.toHaveBeenCalled();
    post.mockRejectedValue(new Error("boom"));
    await expect(resolveOrderNumbers(["00000000-0000-4000-8000-000000000001"])).resolves.toEqual({});
  });
});
