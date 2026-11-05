import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { CalculateOlvaQuoteRequestDto } from "../dto/calculate-olva-quote-request.dto";
import type { OlvaQuoteResponseDto } from "../dto/olva-quote-response.dto";

// POST /olva/quotes -> 200 (a calculation, not a creation)
export async function calculateOlvaQuoteApi(
  requestDto: CalculateOlvaQuoteRequestDto,
): Promise<OlvaQuoteResponseDto> {
  const { data } = await axiosAuth.post<OlvaQuoteResponseDto>(
    `${OLVA_API_BASE_URL}/quotes`,
    requestDto,
  );

  return data;
}
