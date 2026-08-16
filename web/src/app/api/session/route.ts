import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Deliberately its own Route Handler rather than reading the session cookie
// directly in the (static-generated) root layout — `cookies()` anywhere in
// a layout/page's render tree forces that ENTIRE route to render
// dynamically, which would kill static generation/ISR for every page on
// this SEO-focused site (home/search/restaurant-detail all rely on it).
// A separate Route Handler is dynamic on its own terms without affecting
// anything else, and is fetched client-side by `AuthStatus`.
export async function GET() {
  const session = await getSession();
  return NextResponse.json(session);
}
