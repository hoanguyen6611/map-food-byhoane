'use server';

import { setHomeProvince } from '@/lib/home-province';
import { getNearestProvince } from '@/lib/api';

export async function setHomeProvinceAction(province: string): Promise<void> {
  await setHomeProvince(province);
}

/** "Dùng vị trí hiện tại" — the province of the closest published restaurant, or null. */
export async function findNearestProvinceAction(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return getNearestProvince(lat, lng);
}
