export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: boolean;
  redis: boolean;
}
