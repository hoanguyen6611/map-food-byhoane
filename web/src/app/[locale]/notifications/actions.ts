'use server';

import { revalidatePath } from 'next/cache';
import { backendFetchAuthorized } from '@/lib/auth';

export async function markAllNotificationsReadAction(): Promise<void> {
  const res = await backendFetchAuthorized('/me/notifications/read-all', { method: 'PATCH' });
  if (res?.ok) {
    revalidatePath('/notifications', 'page');
    revalidatePath('/en/notifications', 'page');
  }
}
