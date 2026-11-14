'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { findNearestProvinceAction, setHomeProvinceAction } from '@/app/[locale]/actions';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CheckIcon, ChevronDownIcon, CloseIcon, LocateIcon, MapPinIcon, SearchIcon } from '@/components/icons';

interface ProvinceOption {
  code: string;
  name: string;
  shortName: string;
}

interface Props {
  value: string;
  defaultValue: string;
  defaultLabel: string;
  options: ProvinceOption[];
  ariaLabel: string;
  noResultsText: string;
  /** Mobile sheet copy. */
  sheetTitle: string;
  sheetSearchPlaceholder: string;
  closeLabel: string;
  /** Published-restaurant count per province name (from GET /provinces); missing = unknown. */
  counts: Record<string, number>;
  /** Pre-translated "124 quán" per province name (same keys as `counts`). */
  countLabels: Record<string, string>;
  useLocationLabel: string;
  locatingLabel: string;
  locationErrorLabel: string;
}

/**
 * Desktop: the searchable dropdown inside the hero form (its hidden
 * `name="province"` input still rides along on "Tìm"). Mobile (≤767px, CSS
 * picks): the redesign's trigger row + bottom sheet with search. Both
 * persist the choice (`setHomeProvinceAction`, a cookie) and refresh so
 * Home's sections re-fetch scoped to it.
 */
export function HomeProvinceSelect({
  value,
  defaultValue,
  defaultLabel,
  options,
  ariaLabel,
  noResultsText,
  sheetTitle,
  sheetSearchPlaceholder,
  closeLabel,
  counts,
  countLabels,
  useLocationLabel,
  locatingLabel,
  locationErrorLabel,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  function handleChange(next: string) {
    setLocalValue(next);
    startTransition(() => {
      void setHomeProvinceAction(next).then(() => router.refresh());
    });
  }

  const selectOptions = [{ value: defaultValue, label: defaultLabel }, ...options.map((p) => ({ value: p.name, label: p.shortName }))];
  // Sheet order: the default city, then provinces that have restaurants (most
  // first), then the rest alphabetically as they came.
  const sheetOptions = [
    selectOptions[0],
    ...selectOptions
      .slice(1)
      .map((o, i) => ({ o, i }))
      .sort((a, b) => (counts[b.o.value] ?? 0) - (counts[a.o.value] ?? 0) || a.i - b.i)
      .map(({ o }) => o),
  ];

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const name = await findNearestProvinceAction(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        const match = name ? selectOptions.find((o) => o.value === name) : undefined;
        if (!match) {
          setLocationError(true);
          return;
        }
        setOpen(false);
        setQuery('');
        if (match.value !== localValue) handleChange(match.value);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  const currentLabel = selectOptions.find((o) => o.value === localValue)?.label ?? localValue;
  const normalized = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const q = normalized(query.trim());
  const filtered = q ? sheetOptions.filter((o) => normalized(o.label).includes(q)) : sheetOptions;

  return (
    <>
      <span className="home-province-desktop">
        <SearchableSelect
          value={localValue}
          onChange={handleChange}
          options={selectOptions}
          placeholder={ariaLabel}
          noResultsText={noResultsText}
          name="province"
        />
      </span>
      <button
        type="button"
        className="home-province-trigger"
        aria-haspopup="dialog"
        aria-label={`${ariaLabel}: ${currentLabel}`}
        onClick={() => setOpen(true)}
      >
        <MapPinIcon size={16} className="home-province-trigger-pin" />
        <span className="home-province-trigger-label">{currentLabel}</span>
        <ChevronDownIcon size={14} className="home-province-trigger-chevron" />
      </button>
      {mounted && open
        ? createPortal(
            <div className="province-sheet-overlay" onClick={() => setOpen(false)}>
              <div
                className="province-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={sheetTitle}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="province-sheet-grabber" aria-hidden="true" />
                <div className="province-sheet-head">
                  <h2 className="province-sheet-title">{sheetTitle}</h2>
                  <button type="button" className="province-sheet-close" aria-label={closeLabel} onClick={() => setOpen(false)}>
                    <CloseIcon size={16} />
                  </button>
                </div>
                <label className="province-sheet-search">
                  <SearchIcon size={16} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={sheetSearchPlaceholder}
                    aria-label={sheetSearchPlaceholder}
                  />
                </label>
                <button type="button" className="province-sheet-locate" onClick={useCurrentLocation} disabled={locating}>
                  <LocateIcon size={16} />
                  <span>{locating ? locatingLabel : useLocationLabel}</span>
                </button>
                {locationError ? (
                  <p className="province-sheet-error" role="alert">
                    {locationErrorLabel}
                  </p>
                ) : null}
                <ul className="province-sheet-list">
                  {filtered.length === 0 ? <li className="province-sheet-empty">{noResultsText}</li> : null}
                  {filtered.map((o) => {
                    const selected = o.value === localValue;
                    return (
                      <li key={o.value}>
                        <button
                          type="button"
                          className={`province-sheet-item ${selected ? 'province-sheet-item-active' : ''}`}
                          aria-pressed={selected}
                          onClick={() => {
                            setOpen(false);
                            setQuery('');
                            if (!selected) handleChange(o.value);
                          }}
                        >
                          <span className="province-sheet-item-label">{o.label}</span>
                          {countLabels[o.value] ? <span className="province-sheet-item-count">{countLabels[o.value]}</span> : null}
                          {selected ? <CheckIcon size={16} /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
