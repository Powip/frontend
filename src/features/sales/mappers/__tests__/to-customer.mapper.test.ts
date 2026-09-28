import type { CustomerResponseDto } from "../../dto/order.dto";
import { toCustomer } from "../to-customer.mapper";

describe("toCustomer", () => {
  it("conserva googleMapsUrl en el mapping backend -> frontend", () => {
    const dto = {
      id: "client-1",
      companyId: "company-1",
      documentType: "DNI",
      documentNumber: "12345678",
      fullName: "Cliente",
      phoneNumber: "999999999",
      email: null,
      clientType: "TRADICIONAL",
      province: "Lima",
      city: "Lima",
      district: "Miraflores",
      address: "Av. Principal 123",
      reference: null,
      zone: "LIMA_CENTRO",
      latitude: -12.1,
      longitude: -77,
      googleMapsUrl: "https://maps.google.com/?q=-12.1,-77.0",
      isActive: true,
      createdAt: "2026-09-25T10:00:00.000Z",
      updatedAt: "2026-09-25T10:00:00.000Z",
    } as CustomerResponseDto;

    expect(toCustomer(dto).googleMapsUrl).toBe(dto.googleMapsUrl);
  });
});
