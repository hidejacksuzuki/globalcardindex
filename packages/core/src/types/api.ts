export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;       // totalCount のエイリアス
  totalCount: number;  // 後方互換
  totalPages: number;
};
