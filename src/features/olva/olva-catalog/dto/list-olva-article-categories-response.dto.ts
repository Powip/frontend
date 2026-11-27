// GET /olva/catalog/article-categories -> 200 { results }
export interface OlvaArticleCategoryResponseDto {
  articleId: number;
  name: string;
  code: string;
  groupCode: string | null;
}

export interface ListOlvaArticleCategoriesResponseDto {
  results: OlvaArticleCategoryResponseDto[];
}
