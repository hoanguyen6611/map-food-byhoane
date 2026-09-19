'use server';

import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import { getNearbyRestaurants } from '@/lib/api';

// The "use my location" button in MapPageClient (a Client Component, since
// navigator.geolocation only exists in the browser) needs a server-side
// hop to reach the backend the same way every other page here does — this
// Server Action is that hop, not a new REST API route, matching the rest
// of the app's client->backend convention.
export async function getNearbyRestaurantsAction(lat: number, lng: number): Promise<RestaurantSummaryDto[]> {
  return getNearbyRestaurants(lat, lng);
}
