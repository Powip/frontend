import axiosAuth from "@/lib/axiosAuth";
import { deleteSunatProfileApi, replaceSunatProfileCertificateApi } from "../sunat-profile.api";

jest.mock("@/lib/api", () => ({ API: { sunat: "http://sunat.test" } }));

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedAxios = axiosAuth as unknown as {
  put: jest.Mock;
  delete: jest.Mock;
};

describe("sunat-profile api: replace certificate / delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("PUTs the new certificate and its password as multipart to the profile's certificate route", async () => {
    const file = new File(["p12-bytes"], "correcto.p12");
    mockedAxios.put.mockResolvedValue({ data: { id: "profile-1" } });

    const result = await replaceSunatProfileCertificateApi("profile-1", {
      certificate: file,
      certificatePassword: "secreto",
    });

    expect(mockedAxios.put).toHaveBeenCalledTimes(1);

    const [url, body] = mockedAxios.put.mock.calls[0];

    expect(url).toBe("http://sunat.test/api/v1/sunat-profiles/profile-1/certificate");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("certificatePassword")).toBe("secreto");
    expect(((body as FormData).get("certificate") as File).name).toBe("correcto.p12");
    expect(result).toEqual({ id: "profile-1" });
  });

  it("DELETEs the profile by id", async () => {
    mockedAxios.delete.mockResolvedValue({ data: undefined });

    await deleteSunatProfileApi("profile-1");

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      "http://sunat.test/api/v1/sunat-profiles/profile-1",
    );
  });
});
