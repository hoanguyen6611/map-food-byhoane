'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateProfileAction } from '@/app/[locale]/profile/actions';
import { SearchableSelect } from '@/components/SearchableSelect';
import { VN_PROVINCES } from '@foodmap/shared-types';

interface Props {
  displayName: string;
  bio: string;
  homeCity: string;
}

type FormState = { phase: 'idle' } | { phase: 'saved' } | { phase: 'error'; message: string };

const PROVINCE_OPTIONS = VN_PROVINCES.map((p) => ({ value: p.name, label: p.shortName }));

// No phone field here on purpose: `UpdateProfileRequest.phone` can be
// written, but `UserProfileDto` (what `GET /me` actually returns) has no
// phone field to read it back from — showing an input for a value that can
// never be pre-filled or confirmed back would be a broken, misleading loop.
export function EditProfileForm({ displayName, bio, homeCity }: Props) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  // `homeCity` predates this select (it was free text) — an old value that
  // doesn't match any dataset name just shows as unselected rather than
  // being silently discarded; it round-trips unchanged via the hidden input
  // below until the user actively picks a real option.
  const [province, setProvince] = useState(homeCity);

  async function submit(_prev: FormState, formData: FormData): Promise<FormState> {
    const result = await updateProfileAction({
      displayName: String(formData.get('displayName') ?? '').trim() || undefined,
      bio: String(formData.get('bio') ?? '').trim() || undefined,
      homeCity: String(formData.get('homeCity') ?? '').trim() || undefined,
    });
    if (!result.ok) {
      return { phase: 'error', message: result.error === 'unauthorized' ? t('unauthorizedError') : t('saveError') };
    }
    return { phase: 'saved' };
  }

  const [state, formAction, isPending] = useActionState(submit, { phase: 'idle' });

  return (
    <form action={formAction} className="edit-profile-form">
      {state.phase === 'error' ? (
        <p className="write-review-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.phase === 'saved' ? <p className="edit-profile-saved">{t('saved')}</p> : null}

      <label className="login-field">
        <span>{t('displayNameLabel')}</span>
        <input type="text" name="displayName" defaultValue={displayName} maxLength={50} />
      </label>
      <label className="login-field">
        <span>{t('homeCityLabel')}</span>
        <SearchableSelect
          value={province}
          onChange={setProvince}
          options={PROVINCE_OPTIONS}
          placeholder={t('homeCityPlaceholder')}
          noResultsText={tCommon('noResultsFound')}
          name="homeCity"
        />
      </label>
      <label className="login-field">
        <span>{t('bioLabel')}</span>
        <textarea name="bio" defaultValue={bio} rows={3} maxLength={500} />
      </label>

      <button type="submit" className="write-review-submit" disabled={isPending}>
        {isPending ? t('saving') : t('save')}
      </button>
    </form>
  );
}
