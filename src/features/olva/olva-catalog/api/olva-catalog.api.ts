import axiosAuth from "@/lib/axiosAuth";
import { OLVA_API_BASE_URL } from "../../shared/constants/olva-api.constants";
import type { ListOlvaArticleCategoriesResponseDto } from "../dto/list-olva-article-categories-response.dto";
import type { ListOlvaHeadquartersResponseDto } from "../dto/list-olva-headquarters-response.dto";
import type { ListOlvaStandardSizesResponseDto } from "../dto/list-olva-standard-sizes-response.dto";
import type { ListOlvaUbigeosResponseDto } from "../dto/list-olva-ubigeos-response.dto";

const OLVA_CATALOG_BASE = `${OLVA_API_BASE_URL}/catalog`;

// GET /olva/catalog/headquarters -> 200 { results }
export async function getOlvaHeadquartersApi(): Promise<ListOlvaHeadquartersResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaHeadquartersResponseDto>(
    `${OLVA_CATALOG_BASE}/headquarters`,
  );

  return data;
}

// GET /olva/catalog/article-categories -> 200 { results }
export async function getOlvaArticleCategoriesApi(): Promise<ListOlvaArticleCategoriesResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaArticleCategoriesResponseDto>(
    `${OLVA_CATALOG_BASE}/article-categories`,
  );

  return data;
}

// GET /olva/catalog/standard-sizes -> 200 { results }
export async function getOlvaStandardSizesApi(): Promise<ListOlvaStandardSizesResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaStandardSizesResponseDto>(
    `${OLVA_CATALOG_BASE}/standard-sizes`,
  );

  return data;
}

// GET /olva/catalog/ubigeos -> 200 { results }
export async function getOlvaUbigeosApi(): Promise<ListOlvaUbigeosResponseDto> {
  const { data } = await axiosAuth.get<ListOlvaUbigeosResponseDto>(`${OLVA_CATALOG_BASE}/ubigeos`);

  return data;
}
