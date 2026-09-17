'use server';

import { setHomeProvince } from '@/lib/home-province';

export async function setHomeProvinceAction(province: string): Promise<void> {
  await setHomeProvince(province);
}
