export type ApiError<E = unknown> = E;

export type ApiErrorResponse<E> = {
  error: ApiError<E>;
  data?: never;
  status?: number;
};

export interface ApiResponse<T, E = unknown> {
  data: T;
  isSuccess: boolean;
  error: ApiError<E>;
  statusCode: number;
  message: string;
}

export interface ApiPaginatedResponse<T, E = unknown> extends ApiResponse<
  T[],
  E
> {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}
