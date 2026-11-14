'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CuisineDto, UserProfileDto } from '@foodmap/shared-types';
import { EditProfileModal } from './EditProfileModal';
import { ShareButton } from './ShareButton';
import { PencilIcon } from './icons';

interface Props {
  profile: UserProfileDto;
  cuisineOptions: CuisineDto[];
  shareTitle: string;
}

// Edit + share only — sign-out lives once, in the Settings card at the
// bottom of the profile page (ProfileSettingsTab), not duplicated here.
export function ProfileHeaderActions({ profile, cuisineOptions, shareTitle }: Props) {
  const t = useTranslations('profile');
  const [editing, setEditing] = useState(false);

  return (
    <div className="profile-header-actions">
      <button type="button" className="btn-dark" onClick={() => setEditing(true)}>
        <PencilIcon size={16} aria-hidden="true" />
        <span className="btn-dark-label">{t('editHeading')}</span>
      </button>
      <ShareButton title={shareTitle} />
      {editing ? <EditProfileModal profile={profile} cuisineOptions={cuisineOptions} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
