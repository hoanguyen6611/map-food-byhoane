'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { followUserAction, unfollowUserAction } from '@/app/[locale]/profile/[id]/actions';

interface Props {
  targetUserId: string;
  initialIsFollowing: boolean;
  initialFollowerCount: number;
  isLoggedIn: boolean;
}

export function FollowButton({ targetUserId, initialIsFollowing, initialFollowerCount, isLoggedIn }: Props) {
  const router = useRouter();
  const t = useTranslations('publicProfile');
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isPending, setIsPending] = useState(false);

  if (!isLoggedIn) {
    return (
      <button type="button" className="secondary-btn" onClick={() => router.push('/login')}>
        {t('loginToFollow')}
      </button>
    );
  }

  async function handleClick() {
    if (isPending) return;
    setIsPending(true);
    // Optimistic — reverted if the server call fails.
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => (wasFollowing ? c - 1 : c + 1));
    const result = wasFollowing ? await unfollowUserAction(targetUserId) : await followUserAction(targetUserId);
    if (result.ok) {
      setIsFollowing(result.data.isFollowedByViewer);
      setFollowerCount(result.data.followerCount);
    } else {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => (wasFollowing ? c + 1 : c - 1));
    }
    setIsPending(false);
  }

  return (
    <button
      type="button"
      className={isFollowing ? 'secondary-btn' : 'write-review-submit'}
      disabled={isPending}
      onClick={handleClick}
    >
      {isFollowing ? t('following') : t('follow')}
    </button>
  );
}
