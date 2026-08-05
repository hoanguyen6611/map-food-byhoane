import { useMutation } from '@tanstack/react-query';
import type { CreateReportRequest } from '@foodmap/shared-types';
import { reportsApi } from '../api/reports';

/** `POST /reports` — a 409 (ApiError) means this user already reported this exact target. */
export function useReportContent() {
  return useMutation({
    mutationFn: (body: CreateReportRequest) => reportsApi.create(body),
  });
}
