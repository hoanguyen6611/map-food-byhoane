'use client';

import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Danger styling (red icon tile + red confirm button) — both current uses (sign-out, delete account) need it, but this stays a plain prop rather than assuming it, since a future non-destructive confirmation could reuse this same shell. */
  danger?: boolean;
  confirmDisabled?: boolean;
  /** Extra content between the body text and the action buttons — delete-account's "I understand" checkbox, nothing for sign-out. */
  children?: ReactNode;
}

/**
 * Shared confirm dialog for sign-out and delete-account (see
 * "FoodMap - App mobile.dc.html"'s `logoutOpen`/`deleteOpen` bottom sheets —
 * same icon-tile + title + body + Huỷ/confirm-button shape for both, this
 * is the one shell they share). Reuses EditProfileModal's existing
 * `.profile-edit-modal-overlay`/`-panel` (centered modal) as its base —
 * `.confirm-sheet` below turns it into a bottom sheet on mobile only,
 * same technique as `.search-mobile-filter-trigger`'s filter drawer.
 */
export function ConfirmBottomSheet({
  open,
  onClose,
  icon,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onConfirm,
  danger,
  confirmDisabled,
  children,
}: Props) {
  if (!open) return null;

  return (
    <div className="profile-edit-modal-overlay confirm-sheet-overlay" onClick={onClose}>
      <div className="profile-edit-modal-panel confirm-sheet-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" className="profile-edit-modal-close confirm-sheet-close" aria-label={cancelLabel} onClick={onClose}>
          <CloseIcon size={16} />
        </button>
        <div className="confirm-sheet-body">
          <span className={`confirm-sheet-icon ${danger ? 'confirm-sheet-icon-danger' : ''}`} aria-hidden="true">
            {icon}
          </span>
          <h2 className="confirm-sheet-title">{title}</h2>
          <p className="confirm-sheet-text">{body}</p>
          {children}
          <div className="confirm-sheet-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`confirm-sheet-confirm-btn ${danger ? 'confirm-sheet-confirm-btn-danger' : ''}`}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
