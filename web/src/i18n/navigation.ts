import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware re-exports of next/navigation's Link/redirect/usePathname/
// useRouter — every app component should import these instead of the plain
// `next/link`/`next/navigation` versions so locale prefixes are handled
// automatically (e.g. `<Link href="/search">` becomes `/en/search` when the
// current locale is English).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
