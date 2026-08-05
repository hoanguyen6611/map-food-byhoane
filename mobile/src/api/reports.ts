import type { CreateReportRequest, ReportDto } from '@foodmap/shared-types';
import { apiClient } from './client';

/** `POST /reports` — build-prompts/07. A 409 means this user already reported this exact target. */
export const reportsApi = {
  create: (body: CreateReportRequest) => apiClient.post<ReportDto>('/reports', body),
};
