import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/constants';

// Installable PWA — required for Web Push on iPhone/iPad (iOS 16.4+ only
// allows push for a site added to the Home Screen) and gives Android an
// app-like "Cài đặt ứng dụng" entry.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f9f9fb',
    theme_color: '#003cff',
    lang: 'vi',
    icons: [
      { src: '/api/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
