import {
  getOlvaArticleCategoriesApi,
  getOlvaHeadquartersApi,
  getOlvaStandardSizesApi,
  getOlvaUbigeosApi,
} from "../api/olva-catalog.api";
import { toOlvaArticleCategory } from "../mappers/to-olva-article-category";
import { toOlvaHeadquarter } from "../mappers/to-olva-headquarter";
import { toOlvaStandardSize } from "../mappers/to-olva-standard-size";
import { toOlvaUbigeo } from "../mappers/to-olva-ubigeo";
import type { OlvaArticleCategory } from "../models/olva-article-category";
import type { OlvaHeadquarter } from "../models/olva-headquarter";
import type { OlvaStandardSize } from "../models/olva-standard-size";
import type { OlvaUbigeo } from "../models/olva-ubigeo";

export async function getOlvaHeadquarters(): Promise<OlvaHeadquarter[]> {
  const { results } = await getOlvaHeadquartersApi();

  return results.map(toOlvaHeadquarter);
}

export async function getOlvaArticleCategories(): Promise<OlvaArticleCategory[]> {
  const { results } = await getOlvaArticleCategoriesApi();

  return results.map(toOlvaArticleCategory);
}

export async function getOlvaStandardSizes(): Promise<OlvaStandardSize[]> {
  const { results } = await getOlvaStandardSizesApi();

  return results.map(toOlvaStandardSize);
}

export async function getOlvaUbigeos(): Promise<OlvaUbigeo[]> {
  const { results } = await getOlvaUbigeosApi();

  return results.map(toOlvaUbigeo);
}
