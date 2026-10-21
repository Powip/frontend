import axiosAuth from "@/lib/axiosAuth";
import { adjustStock } from "@/services/stockAdjustmentService";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn() } }));

it("envía el ajuste a la fachada autenticada de productos (FEAT-24 H0)", async () => {
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { inventoryItemId: "i", quantity: 1, reservedQuantity: 0, reservedWithoutStock: 0 } });
  await expect(adjustStock({ inventoryItemId: "i", direction: "OUT", quantity: 1, reason: "dano" })).resolves.toEqual({
    inventoryItemId: "i", quantity: 1, reservedQuantity: 0, reservedWithoutStock: 0,
  });
  expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/tracking\/stock-adjustments$/), {
    inventoryItemId: "i", direction: "OUT", quantity: 1, reason: "dano",
  });
});
