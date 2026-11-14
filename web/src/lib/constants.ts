// Single source of truth for the brand name — previously duplicated as a
// local `const SITE_NAME` in layout.tsx/SiteTopBar.tsx/SiteFooter.tsx.
export const SITE_NAME = 'Bản Đồ Ẩm Thực';

/**
 * Footer extras from the mobile footer design. Each is rendered ONLY when
 * filled in — no dead links while the page/account doesn't exist yet.
 * Internal paths ("/terms") or full URLs ("https://…", "mailto:…").
 */
export const SOCIAL_LINKS: { facebook: string; instagram: string; tiktok: string } = {
  facebook: '',
  instagram: '',
  tiktok: '',
};

export const FOOTER_LINKS: { contact: string; terms: string; privacy: string; communityGuidelines: string } = {
  contact: '',
  terms: '',
  privacy: '',
  communityGuidelines: '',
};
