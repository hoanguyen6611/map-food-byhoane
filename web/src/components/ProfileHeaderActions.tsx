'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CuisineDto, UserProfileDto } from '@foodmap/shared-types';
import { EditProfileModal } from './EditProfileModal';
import { ShareButton } from './ShareButton';

interface Props {
  profile: UserProfileDto;
  cuisineOptions: CuisineDto[];
  shareTitle: string;
}

export function ProfileHeaderActions({ profile, cuisineOptions, shareTitle }: Props) {
  const t = useTranslations('profile');
  const [editing, setEditing] = useState(false);

  return (
    <div className="profile-header-actions">
      <button type="button" className="btn-dark" onClick={() => setEditing(true)}>
        {t('editHeading')}
      </button>
      <ShareButton title={shareTitle} />
      {editing ? <EditProfileModal profile={profile} cuisineOptions={cuisineOptions} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
