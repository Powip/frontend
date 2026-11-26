import { renderHook } from "@testing-library/react";
import type { Conversation } from "@/types/crm";
import { useChatSuggestion } from "../useChatSuggestion";

let mockMode: "off" | "copilot" | "auto" | undefined;
let mockStoreModes: Record<string, "off" | "copilot" | "auto"> | undefined;
const mockDetect = jest.fn();

jest.mock("../useCrmPau", () => ({
  usePauSettings: () => ({ data: mockMode ? { mode: mockMode, storeModes: mockStoreModes } : undefined }),
}));
jest.mock("../useCrmContent", () => ({
  useScript: () => ({ data: { steps: [{ name: "Saludo", message: "Hola", question: "¿Para dónde lo deseas?" }] } }),
  useGeneralMaterials: () => ({ data: [] }),
  useRegisterObjectionUse: () => ({ mutate: jest.fn() }),
}));
jest.mock("../useCrmSalesTools", () => ({
  useDetectObjection: (...args: unknown[]) => {
    mockDetect(...args);
    return { data: undefined };
  },
}));
jest.mock("../useChatCart", () => ({ useChatCart: () => ({ lowStock: null }) }));

const conversation = {
  id: "c1",
  status: "open",
  lastInboundAt: "2026-11-24T10:00:00Z",
  contactName: "Ana",
} as unknown as Conversation;

describe("useChatSuggestion según el modo de Pau", () => {
  beforeEach(() => {
    mockDetect.mockClear();
    mockStoreModes = undefined;
  });

  it("manda el modo de la tienda del chat sobre el general", () => {
    mockMode = "copilot";
    mockStoreModes = { kunca: "off" };
    const inKunca = { ...conversation, storeId: "kunca" } as Conversation;
    const inLivii = { ...conversation, storeId: "livii" } as Conversation;
    expect(renderHook(() => useChatSuggestion(inKunca, true)).result.current).toBeNull();
    expect(renderHook(() => useChatSuggestion(inLivii, true)).result.current?.text).toBeTruthy();
  });

  it("Pau apagado: no sugiere ni consulta objeciones", () => {
    mockMode = "off";
    const { result } = renderHook(() => useChatSuggestion(conversation, true));
    expect(result.current).toBeNull();
    expect(mockDetect).toHaveBeenCalledWith("c1", conversation.lastInboundAt, false);
  });

  it("modo aún sin leer: no sugiere", () => {
    mockMode = undefined;
    const { result } = renderHook(() => useChatSuggestion(conversation, true));
    expect(result.current).toBeNull();
  });

  it.each(["copilot", "auto"] as const)("modo %s: sugiere el paso del guion", (mode) => {
    mockMode = mode;
    const { result } = renderHook(() => useChatSuggestion(conversation, true));
    expect(result.current?.text).toBeTruthy();
    expect(mockDetect).toHaveBeenCalledWith("c1", conversation.lastInboundAt, true);
  });
});
