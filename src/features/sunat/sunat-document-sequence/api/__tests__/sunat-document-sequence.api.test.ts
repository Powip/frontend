import axiosAuth from "@/lib/axiosAuth";
import {
  deleteSunatDocumentSequenceApi,
  getSunatDocumentSequencesApi,
  initializeSunatDocumentSequenceApi,
  setDefaultSunatDocumentSequenceApi,
} from "../sunat-document-sequence.api";

jest.mock("@/lib/api", () => ({ API: { sunat: "http://sunat.test" } }));

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedAxios = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

const BASE = "http://sunat.test/api/v1/sunat-document-sequences";

describe("sunat-document-sequence api (multi-RUC)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: undefined });
  });

  it("sin RUC lista las series del predeterminado, igual que antes", async () => {
    await getSunatDocumentSequencesApi();

    expect(mockedAxios.get).toHaveBeenCalledWith(`${BASE}/company`, undefined);
  });

  it("con RUC envía sunatProfileId como query", async () => {
    await getSunatDocumentSequencesApi("profile-2");

    expect(mockedAxios.get).toHaveBeenCalledWith(`${BASE}/company`, {
      params: { sunatProfileId: "profile-2" },
    });
  });

  it("crea, marca y elimina series del RUC indicado", async () => {
    await initializeSunatDocumentSequenceApi({
      taxDocumentType: "03",
      series: "B002",
      lastCorrelative: 10,
      sunatProfileId: "profile-2",
    });
    await setDefaultSunatDocumentSequenceApi({
      taxDocumentType: "03",
      series: "B002",
      sunatProfileId: "profile-2",
    });
    await deleteSunatDocumentSequenceApi({
      taxDocumentType: "03",
      series: "B002",
      sunatProfileId: "profile-2",
    });

    expect(mockedAxios.post.mock.calls[0][1]).toMatchObject({ sunatProfileId: "profile-2" });
    expect(mockedAxios.patch.mock.calls[0][1]).toMatchObject({ sunatProfileId: "profile-2" });
    expect(mockedAxios.delete.mock.calls[0][1]).toEqual({
      params: { taxDocumentType: "03", series: "B002", sunatProfileId: "profile-2" },
    });
  });
});
