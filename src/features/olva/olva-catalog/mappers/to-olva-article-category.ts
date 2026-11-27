import type { OlvaArticleCategoryResponseDto } from "../dto/list-olva-article-categories-response.dto";
import type { OlvaArticleCategory } from "../models/olva-article-category";

export function toOlvaArticleCategory(dto: OlvaArticleCategoryResponseDto): OlvaArticleCategory {
  return { id: dto.articleId, name: dto.name, code: dto.code, groupCode: dto.groupCode };
}
