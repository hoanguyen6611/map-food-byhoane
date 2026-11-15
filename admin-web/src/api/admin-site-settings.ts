import type { SiteSettingKey, SiteSettingsDto } from '@foodmap/shared-types'
import { apiClient } from './client'

/** Admin "Nội dung & Cài đặt" — see backend AdminSiteSettingsController. PUT is admin-only. */
export const adminSiteSettingsApi = {
  get: () => apiClient.get<SiteSettingsDto>('/admin/site-settings'),
  update: <K extends SiteSettingKey>(key: K, value: SiteSettingsDto[K]) =>
    apiClient.put<SiteSettingsDto>(`/admin/site-settings/${key}`, { value }),
}
