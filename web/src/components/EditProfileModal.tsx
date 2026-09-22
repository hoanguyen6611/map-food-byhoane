'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { updateAvatarAction, updateProfileAction } from '@/app/[locale]/profile/actions';
import { SearchableSelect } from '@/components/SearchableSelect';
import { AvatarUploadButton } from '@/components/AvatarUploadButton';
import { FacebookIcon, InstagramIcon, CloseIcon } from '@/components/icons';
import { useToast } from '@/components/ToastProvider';
import { CUISINE_OPTIONS } from '@/lib/labels';
import { VN_PROVINCES, type CuisineCode, type UserProfileDto } from '@foodmap/shared-types';

interface Props {
  profile: UserProfileDto;
  onClose: () => void;
}

type FormState = { phase: 'idle' } | { phase: 'saved' } | { phase: 'error'; message: string };

const PROVINCE_OPTIONS = VN_PROVINCES.map((p) => ({ value: p.name, label: p.shortName }));
const BIO_MAX_LENGTH = 160;

// No phone field here on purpose: `UpdateProfileRequest.phone` can be
// written, but `UserProfileDto` (what `GET /me` actually returns) has no
// phone field to read it back from — showing an input for a value that can
// never be pre-filled or confirmed back would be a broken, misleading loop.
export function EditProfileModal({ profile, onClose }: Props) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tLabels = useTranslations('labels');
  const { showToast } = useToast();

  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [province, setProvince] = useState(profile.homeCity ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [cuisines, setCuisines] = useState<CuisineCode[]>(profile.favoriteCuisines);
  const [facebookUrl, setFacebookUrl] = useState(profile.facebookUrl ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile.instagramUrl ?? '');
  const [isPublic, setIsPublic] = useState(profile.isPublic);

  function toggleCuisine(code: CuisineCode) {
    setCuisines((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleAvatarUploaded(url: string) {
    const previous = avatarUrl;
    setAvatarUrl(url);
    const result = await updateAvatarAction(url);
    if (!result.ok) {
      setAvatarUrl(previous);
      showToast(t('avatarUploadError'), 'error');
    }
  }

  async function handleAvatarCleared() {
    const previous = avatarUrl;
    setAvatarUrl(null);
    const result = await updateAvatarAction(null);
    if (!result.ok) {
      setAvatarUrl(previous);
      showToast(t('avatarUploadError'), 'error');
    }
  }

  async function submit(_prev: FormState): Promise<FormState> {
    const result = await updateProfileAction({
      displayName: displayName.trim() || undefined,
      homeCity: province || undefined,
      bio: bio.trim(),
      username: username.trim() || undefined,
      favoriteCuisines: cuisines,
      facebookUrl: facebookUrl.trim() || undefined,
      instagramUrl: instagramUrl.trim() || undefined,
      isPublic,
    });
    if (!result.ok) {
      const message =
        result.error === 'unauthorized'
          ? t('unauthorizedError')
          : result.error === 'generic'
            ? t('saveError')
            : result.error;
      return { phase: 'error', message };
    }
    showToast(t('saved'), 'success');
    onClose();
    return { phase: 'saved' };
  }

  const [state, formAction, isPending] = useActionState(submit, { phase: 'idle' });

  return (
    <div className="profile-edit-modal-overlay" onClick={onClose}>
      <div className="profile-edit-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="photo-lightbox-close" aria-label={tCommon('closeMenuAriaLabel')} onClick={onClose}>
          <CloseIcon size={16} />
        </button>
        <h2 className="info-card-title" style={{ margin: '0 0 4px' }}>
          {t('editHeading')}
        </h2>
        <p className="profile-edit-modal-sub">{t('editSubheading')}</p>

        <form action={formAction} className="edit-profile-form profile-edit-modal-body">
          {state.phase === 'error' ? (
            <p className="write-review-error" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="login-field">
            <span>{t('avatarLabel')}</span>
            <AvatarUploadButton
              avatarUrl={avatarUrl}
              displayName={displayName}
              onUploaded={handleAvatarUploaded}
              onCleared={handleAvatarCleared}
              uploadLabel={t('avatarUpload')}
              useInitialsLabel={t('avatarUseInitials')}
              uploadingLabel={t('avatarUploading')}
              errorLabel={t('avatarUploadError')}
            />
            <span className="profile-edit-hint">{t('avatarHint')}</span>
          </div>

          <div className="profile-edit-two-col">
            <label className="login-field">
              <span>{t('displayNameLabel')}</span>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
            </label>
            <label className="login-field">
              <span>{t('usernameLabel')}</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={24}
                placeholder={t('usernamePlaceholder')}
              />
            </label>
          </div>

          <label className="login-field">
            <span>
              {t('bioLabel')} <span className="profile-edit-hint">{bio.length}/{BIO_MAX_LENGTH}</span>
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
              rows={3}
              maxLength={BIO_MAX_LENGTH}
            />
          </label>

          <label className="login-field">
            <span>{t('homeCityLabel')}</span>
            <SearchableSelect
              value={province}
              onChange={setProvince}
              options={PROVINCE_OPTIONS}
              placeholder={t('homeCityPlaceholder')}
              noResultsText={tCommon('noResultsFound')}
            />
          </label>

          <div className="login-field">
            <span>{t('favoriteCuisinesLabel')}</span>
            <div className="chip-row">
              {CUISINE_OPTIONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`chip chip-toggle ${cuisines.includes(code) ? 'chip-selected' : ''}`}
                  onClick={() => toggleCuisine(code)}
                >
                  {tLabels(`cuisine.${code}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="login-field">
            <span>{t('socialLinksLabel')}</span>
            <div className="login-input-wrap">
              <FacebookIcon size={17} style={{ color: 'var(--color-ink-subtle)' }} />
              <input
                type="text"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="facebook.com/ten-cua-ban"
              />
            </div>
            <div className="login-input-wrap" style={{ marginTop: 8 }}>
              <InstagramIcon size={17} style={{ color: 'var(--color-ink-subtle)' }} />
              <input
                type="text"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="instagram.com/ten-cua-ban"
              />
            </div>
          </div>

          <div className="filter-toggle-row">
            <div className="filter-toggle-text">
              <span className="filter-toggle-title">{t('publicToggleLabel')}</span>
              <span className="filter-toggle-sub">{t('publicToggleSub')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              aria-label={t('publicToggleLabel')}
              className={`toggle-switch ${isPublic ? 'toggle-switch-on' : 'toggle-switch-off'}`}
              onClick={() => setIsPublic((v) => !v)}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="profile-edit-modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="write-review-submit" disabled={isPending}>
              {isPending ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
