interface Props {
  isOpen: boolean;
  /** Pre-translated label, e.g. tCommon('openNow') / tCommon('closedNow'). */
  label: string;
  /** Optional pre-translated note appended after " · ", e.g. "đến 22:00". */
  note?: string;
}

/** Open/closed status pill — README's `OpenBadge` spec. Plain props (no i18n inside) so it works from Server Components. */
export function OpenBadge({ isOpen, label, note }: Props) {
  return (
    <span className={`open-badge ${isOpen ? 'open-badge-open' : 'open-badge-closed'}`}>
      <span className="open-badge-dot" aria-hidden="true" />
      {label}
      {note ? ` · ${note}` : ''}
    </span>
  );
}
