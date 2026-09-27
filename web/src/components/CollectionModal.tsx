'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CollectionSummaryDto } from '@foodmap/shared-types';
import { createCollectionAction, updateCollectionAction } from '@/app/[locale]/collections/actions';
import { CloseIcon, CheckIcon } from '@/components/icons';

// Structural subset — deliberately loose so both CollectionSummaryDto (the
// list page) and CollectionDetailDto (the detail page's edit button)
// satisfy it without an adapter, same pattern RestaurantCard's
// RestaurantCardData uses for its two source DTOs.
interface EditableCollection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

interface Props {
  collection?: EditableCollection;
  onClose: () => void;
  onSaved: (collection: CollectionSummaryDto) => void;
}

type FormState = { phase: 'idle' } | { phase: 'error'; message: string };

const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 500;

// Shared by "create" (no `collection` prop) and "edit" — same fields either
// way, styled identically to EditProfileModal (this codebase's established
// modal-with-a-public-toggle pattern), reusing its exact CSS classes rather
// than inventing a parallel modal look.
export function CollectionModal({ collection, onClose, onSaved }: Props) {
  const t = useTranslations('collections');
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [isPublic, setIsPublic] = useState(collection?.isPublic ?? false);

  async function submit(_prev: FormState): Promise<FormState> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { phase: 'error', message: t('nameRequiredError') };
    }
    const result = collection
      ? await updateCollectionAction(collection.id, { name: trimmedName, description: description.trim(), isPublic })
      : await createCollectionAction(trimmedName, description.trim() || undefined);
    if (!result.ok) {
      return { phase: 'error', message: t('saveError') };
    }
    onSaved(result.data);
    onClose();
    return { phase: 'idle' };
  }

  const [state, formAction, isPending] = useActionState(submit, { phase: 'idle' });

  return (
    <div className="profile-edit-modal-overlay" onClick={onClose}>
      <div className="profile-edit-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-edit-modal-scroll">
          <div className="profile-edit-modal-header">
            <h2 className="info-card-title" style={{ margin: 0 }}>
              {collection ? t('editHeading') : t('createHeading')}
            </h2>
            <button type="button" className="profile-edit-modal-close" aria-label={t('cancel')} onClick={onClose}>
              <CloseIcon size={16} />
            </button>
          </div>

          <form action={formAction} className="edit-profile-form profile-edit-modal-body">
            {state.phase === 'error' ? (
              <p className="write-review-error" role="alert">
                {state.message}
              </p>
            ) : null}

            <label className="login-field">
              <span>{t('nameLabel')}</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX_LENGTH} />
            </label>

            <label className="login-field">
              <span>{t('descriptionLabel')}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                rows={3}
                maxLength={DESCRIPTION_MAX_LENGTH}
              />
            </label>

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
              <span />
              <div className="profile-edit-modal-footer-actions">
                <button type="button" className="secondary-btn" onClick={onClose}>
                  {t('cancel')}
                </button>
                <button type="submit" className="write-review-submit" disabled={isPending}>
                  {isPending ? null : <CheckIcon size={14} />}
                  {isPending ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
