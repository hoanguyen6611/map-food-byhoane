'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';

export async function markNotificationReadAction(id: string): Promise<void> {
  const res = await backendFetchAuthorized(`/me/notifications/${id}/read`, { method: 'PATCH' });
  if (res?.ok) {
    revalidatePath('/notifications', 'page');
    revalidatePath('/en/notifications', 'page');
  }
}
