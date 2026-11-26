import { redirect } from "next/navigation";
import Page from "../page";

// FEAT-33 A12: el link viejo de asesora (/catalogo/{tienda}?a=) lleva al formato nuevo; el resto sigue igual.
jest.mock("next/navigation", () => ({ redirect: jest.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
jest.mock("@/features/live/LiveStorefront", () => ({ __esModule: true, default: () => null }));

beforeEach(() => jest.clearAllMocks());

const call = (slug: string, query: Record<string, string | string[]>) =>
  Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });

test("an advisor link moves to /live/{tienda}?a=CÓDIGO keeping the rest of the query", async () => {
  await expect(call("kunca", { a: "ana-111111", utm_source: "tiktok" })).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/live/kunca?a=ana-111111&utm_source=tiktok");
});

test("an old link without a code keeps opening the catalog (POWIP Link)", async () => {
  const element = await call("kunca", {});
  expect(redirect).not.toHaveBeenCalled();
  expect(element.props.slug).toBe("kunca");
});
