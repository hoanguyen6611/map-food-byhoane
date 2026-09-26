'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { resolveGoogleMapsLinkAction, submitContributionAction } from '@/app/[locale]/add-restaurant/actions';
import { PhotoUploadField, type UploadedPhoto } from '@/components/PhotoUploadField';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CloseIcon, FacilityIcon, LocateIcon } from '@/components/icons';
import { DEFAULT_FACILITY_ICON_PATH, FACILITY_ICON_PATH, PRICE_BUCKETS } from '@/lib/labels';
import { VN_PROVINCES, type CategoryDto, type CuisineCode, type CuisineDto, type DuplicateCandidateDto, type FacilityDto, type FacilityType } from '@foodmap/shared-types';

// A contributor's own "+ Thêm mới" cuisine/facility isn't in the catalog yet
// (that's the whole point), so it can't be toggled by matching a `code` —
// tracked as free-text labels instead, alongside the existing code-based
// selections, and submitted as `newCuisineLabels`/`newFacilityLabels`.
const MAX_NEW_OPTIONS = 5;

type Phase =
  | { kind: 'form' }
  | { kind: 'duplicate'; candidates: DuplicateCandidateDto[] }
  | { kind: 'done'; status: 'auto_approved' | 'in_review' }
  | { kind: 'error'; message: string };

interface Props {
  /** Live categories (admin-editable) fetched server-side — not a hardcoded list, so a newly admin-created category is selectable here too. */
  categories: CategoryDto[];
  /** Live cuisines (admin-editable), same reasoning as `categories`. */
  cuisines: CuisineDto[];
  /** Live facilities (admin-editable), same reasoning as `cuisines`. */
  facilities: FacilityDto[];
}

export function AddRestaurantForm({ categories, cuisines, facilities }: Props) {
  const t = useTranslations('addRestaurant');
  const tLabels = useTranslations('labels');
  const tCommon = useTranslations('common');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [priceRangeCode, setPriceRangeCode] = useState('');
  const [phone, setPhone] = useState('');
  const [cuisineCodes, setCuisineCodes] = useState<CuisineCode[]>([]);
  const [facilityCodes, setFacilityCodes] = useState<FacilityType[]>([]);
  // "+ Thêm mới" — free-text options not yet in the catalog; see this
  // file's top-of-file comment.
  const [newCuisineLabels, setNewCuisineLabels] = useState<string[]>([]);
  const [newFacilityLabels, setNewFacilityLabels] = useState<string[]>([]);
  const [newCuisineInput, setNewCuisineInput] = useState('');
  const [newFacilityInput, setNewFacilityInput] = useState('');
  const [isAddingCuisine, setIsAddingCuisine] = useState(false);
  const [isAddingFacility, setIsAddingFacility] = useState(false);
  const [line, setLine] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [linkStatus, setLinkStatus] = useState<'idle' | 'resolving' | 'resolved' | 'error'>('idle');
  // The (trimmed) link value `linkStatus` currently reflects — lets onChange/
  // onBlur tell "this exact link already resolved (or is resolving)" apart
  // from "the field changed since then", instead of both independently
  // racing to call resolveMapLink for the same paste (see resolveMapLink's
  // own doc comment for the bug this fixes).
  const [resolvedLink, setResolvedLink] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'resolved' | 'unsupported' | 'denied' | 'error'>('idle');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // Deliberately simple: one open/close time applied to every day, plus
  // which days (if any) are closed — not the admin panel's full per-day
  // grid (per-day times + 24h + split lunch/dinner range). A community
  // contributor filling this in on the public site just needs "we're open
  // roughly X–Y, closed on Z" to be one glance, not a 7-row form.
  const [hasOpeningHours, setHasOpeningHours] = useState(false);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [closedDays, setClosedDays] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(String(position.coords.latitude));
        setLng(String(position.coords.longitude));
        setMapLink('');
        setLinkStatus('idle');
        setResolvedLink(null);
        setGeoStatus('resolved');
      },
      (error) => {
        setGeoStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /**
   * Was reachable from three places — onPaste (immediate), onBlur
   * (fallback for typed/edited links) and the "Áp dụng" button — with
   * onBlur's guard checking `linkStatus === 'idle'`. Pasting fires onPaste
   * (starts resolving, i.e. sets 'resolving') immediately followed by
   * onChange (which unconditionally reset status back to 'idle'); if the
   * user then blurred the field before the paste's own resolve finished,
   * onBlur saw 'idle' and fired a SECOND concurrent resolve for the same
   * link — the "double" behavior reported. `resolvedLink` now tracks which
   * link the current status actually reflects, so onChange/onBlur only
   * reset/re-trigger when the field holds a link that isn't already
   * resolved-or-resolving.
   */
  async function resolveMapLink(link: string) {
    const trimmed = link.trim();
    if (!trimmed) return;
    setLinkStatus('resolving');
    setResolvedLink(trimmed);
    const result = await resolveGoogleMapsLinkAction(trimmed);
    if (result.ok) {
      setLat(String(result.location.lat));
      setLng(String(result.location.lng));
      setLinkStatus('resolved');
    } else {
      setLat('');
      setLng('');
      setLinkStatus('error');
    }
  }

  function toggleCuisine(code: CuisineCode) {
    setCuisineCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function toggleFacility(code: FacilityType) {
    setFacilityCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function addNewCuisine() {
    const label = newCuisineInput.trim();
    if (!label) return;
    const alreadyAdded = newCuisineLabels.some((l) => l.toLowerCase() === label.toLowerCase());
    if (!alreadyAdded) setNewCuisineLabels((prev) => [...prev, label]);
    setNewCuisineInput('');
  }

  function removeNewCuisine(label: string) {
    setNewCuisineLabels((prev) => prev.filter((l) => l !== label));
  }

  function addNewFacility() {
    const label = newFacilityInput.trim();
    if (!label) return;
    const alreadyAdded = newFacilityLabels.some((l) => l.toLowerCase() === label.toLowerCase());
    if (!alreadyAdded) setNewFacilityLabels((prev) => [...prev, label]);
    setNewFacilityInput('');
  }

  function removeNewFacility(label: string) {
    setNewFacilityLabels((prev) => prev.filter((l) => l !== label));
  }

  function toggleClosedDay(dayOfWeek: number) {
    setClosedDays((prev) => (prev.includes(dayOfWeek) ? prev.filter((d) => d !== dayOfWeek) : [...prev, dayOfWeek]));
  }

  const selectedProvince = useMemo(() => VN_PROVINCES.find((p) => p.code === provinceCode), [provinceCode]);
  const provinceOptions = useMemo(() => VN_PROVINCES.map((p) => ({ value: p.code, label: p.shortName })), []);
  const wardOptions = useMemo(
    () => (selectedProvince?.wards ?? []).map((w) => ({ value: w.code, label: w.shortName })),
    [selectedProvince],
  );

  function handleProvinceChange(code: string) {
    setProvinceCode(code);
    setWardCode('');
  }

  // A restaurant can't sensibly be "closed every single day" while the
  // opening-hours toggle is on — that combo silently discards the open/close
  // time the contributor typed (nothing is left to attach it to) and looks
  // to them like the form ate their input. Block submission instead of
  // saving it, so it surfaces immediately rather than as a support report
  // days later. See: restaurant 79356ddc-6196-42ec-92d4-7c28177aab79.
  const allDaysMarkedClosed = closedDays.length === 7;

  const canSubmit =
    name.trim().length >= 2 &&
    categoryCode !== '' &&
    line.trim() !== '' &&
    provinceCode !== '' &&
    wardCode !== '' &&
    lat !== '' &&
    lng !== '' &&
    photos.length > 0 &&
    !(hasOpeningHours && allDaysMarkedClosed);

  async function submit(duplicateConfirmed: boolean) {
    if (!canSubmit || !selectedProvince) return;
    const ward = selectedProvince.wards.find((w) => w.code === wardCode);
    if (!ward) return;
    setIsSubmitting(true);
    const result = await submitContributionAction({
      name: name.trim(),
      description: description.trim() || undefined,
      categoryCode: categoryCode as never,
      priceRangeCode: priceRangeCode ? (priceRangeCode as never) : undefined,
      phone: phone.trim() || undefined,
      address: { line: line.trim(), ward: ward.name, province: selectedProvince.name },
      location: { lat: Number(lat), lng: Number(lng) },
      cuisineCodes: cuisineCodes.length > 0 ? cuisineCodes : undefined,
      newCuisineLabels: newCuisineLabels.length > 0 ? newCuisineLabels : undefined,
      facilities: facilityCodes.length > 0 ? facilityCodes : undefined,
      newFacilityLabels: newFacilityLabels.length > 0 ? newFacilityLabels : undefined,
      openingHours:
        hasOpeningHours && openTime && closeTime
          ? Array.from({ length: 7 }, (_, dayOfWeek) => {
              const isClosed = closedDays.includes(dayOfWeek);
              return { dayOfWeek, isClosed, openTime: isClosed ? undefined : openTime, closeTime: isClosed ? undefined : closeTime };
            })
          : undefined,
      photoUrls: photos.map((p) => p.url),
      coverPhotoUrl: coverUrl ?? undefined,
      duplicateConfirmed,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      if (result.error === 'duplicate') {
        setPhase({ kind: 'duplicate', candidates: result.candidates });
        return;
      }
      setPhase({
        kind: 'error',
        message: result.error === 'unauthorized' ? t('unauthorizedError') : result.message || t('genericError'),
      });
      return;
    }
    setPhase({ kind: 'done', status: result.status === 'auto_approved' ? 'auto_approved' : 'in_review' });
  }

  if (phase.kind === 'done') {
    return (
      <div className="write-review-done">
        <strong>{phase.status === 'auto_approved' ? t('publishedTitle') : t('pendingTitle')}</strong>
        <p>{phase.status === 'auto_approved' ? t('publishedBody') : t('pendingBody')}</p>
      </div>
    );
  }

  if (phase.kind === 'duplicate') {
    return (
      <div className="write-review-done">
        <strong>{t('duplicateTitle')}</strong>
        <p>{t('duplicateBody')}</p>
        <ul>
          {phase.candidates.map((c) => (
            <li key={c.id}>
              {c.name} — {c.fullAddressText} ({Math.round(c.distanceMeters)}m)
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="write-review-submit"
            disabled={isSubmitting}
            onClick={() => submit(true)}
          >
            {t('submitAnyway')}
          </button>
          <button type="button" className="secondary-btn" onClick={() => setPhase({ kind: 'form' })}>
            {t('backToEdit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="write-review-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {phase.kind === 'error' ? (
        <p className="write-review-error" role="alert">
          {phase.message}
        </p>
      ) : null}

      <label className="login-field">
        <span>{t('nameLabel')}</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </label>

      <label className="login-field">
        <span>{t('descriptionLabel')}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
      </label>

      <label className="login-field">
        <span>{t('categoryLabel')}</span>
        <select value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} required>
          <option value="">{t('selectPlaceholder')}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label className="login-field">
        <span>{t('priceRangeLabel')}</span>
        <select value={priceRangeCode} onChange={(e) => setPriceRangeCode(e.target.value)}>
          <option value="">{t('selectPlaceholder')}</option>
          {PRICE_BUCKETS.map((bucket) => (
            <option key={bucket.code} value={bucket.code}>
              {tLabels(`priceBucket.${bucket.code}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="login-field">
        <span>{t('cuisineLabel')}</span>
        <div className="chip-row">
          {cuisines.map((cuisine) => (
            <button
              key={cuisine.code}
              type="button"
              className={`chip chip-toggle ${cuisineCodes.includes(cuisine.code) ? 'chip-selected' : ''}`}
              onClick={() => toggleCuisine(cuisine.code)}
            >
              {cuisine.label}
            </button>
          ))}
          {newCuisineLabels.map((label) => (
            <span key={label} className="chip chip-selected chip-new">
              {label}
              <button
                type="button"
                className="chip-remove-btn"
                aria-label={t('removeCustomOption')}
                onClick={() => removeNewCuisine(label)}
              >
                <CloseIcon size={11} />
              </button>
            </span>
          ))}
          {!isAddingCuisine && newCuisineLabels.length < MAX_NEW_OPTIONS ? (
            <button type="button" className="chip chip-add-new" onClick={() => setIsAddingCuisine(true)}>
              + {t('addCustomOption')}
            </button>
          ) : null}
        </div>
        {isAddingCuisine ? (
          <div className="chip-add-input-row">
            <input
              type="text"
              value={newCuisineInput}
              placeholder={t('addCustomOptionPlaceholder')}
              maxLength={50}
              onChange={(e) => setNewCuisineInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewCuisine();
                }
              }}
            />
            <button type="button" className="chip-add-confirm-btn" disabled={!newCuisineInput.trim()} onClick={addNewCuisine}>
              {t('addCustomOptionConfirm')}
            </button>
            <button
              type="button"
              className="chip-add-cancel-btn"
              onClick={() => {
                setIsAddingCuisine(false);
                setNewCuisineInput('');
              }}
            >
              {t('addCustomOptionCancel')}
            </button>
          </div>
        ) : null}
        {newCuisineLabels.length > 0 ? <p className="chip-add-hint">{t('customOptionPendingHint')}</p> : null}
      </div>

      <div className="login-field">
        <span>{t('facilitiesLabel')}</span>
        <div className="chip-row">
          {facilities.map((facility) => (
            <button
              key={facility.code}
              type="button"
              className={`chip chip-toggle ${facilityCodes.includes(facility.code) ? 'chip-selected' : ''}`}
              onClick={() => toggleFacility(facility.code)}
            >
              <FacilityIcon path={FACILITY_ICON_PATH[facility.code] ?? DEFAULT_FACILITY_ICON_PATH} size={13} />
              {facility.label}
            </button>
          ))}
          {newFacilityLabels.map((label) => (
            <span key={label} className="chip chip-selected chip-new">
              {label}
              <button
                type="button"
                className="chip-remove-btn"
                aria-label={t('removeCustomOption')}
                onClick={() => removeNewFacility(label)}
              >
                <CloseIcon size={11} />
              </button>
            </span>
          ))}
          {!isAddingFacility && newFacilityLabels.length < MAX_NEW_OPTIONS ? (
            <button type="button" className="chip chip-add-new" onClick={() => setIsAddingFacility(true)}>
              + {t('addCustomOption')}
            </button>
          ) : null}
        </div>
        {isAddingFacility ? (
          <div className="chip-add-input-row">
            <input
              type="text"
              value={newFacilityInput}
              placeholder={t('addCustomOptionPlaceholder')}
              maxLength={50}
              onChange={(e) => setNewFacilityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewFacility();
                }
              }}
            />
            <button type="button" className="chip-add-confirm-btn" disabled={!newFacilityInput.trim()} onClick={addNewFacility}>
              {t('addCustomOptionConfirm')}
            </button>
            <button
              type="button"
              className="chip-add-cancel-btn"
              onClick={() => {
                setIsAddingFacility(false);
                setNewFacilityInput('');
              }}
            >
              {t('addCustomOptionCancel')}
            </button>
          </div>
        ) : null}
        {newFacilityLabels.length > 0 ? <p className="chip-add-hint">{t('customOptionPendingHint')}</p> : null}
      </div>

      <label className="login-field">
        <span>{t('phoneLabel')}</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>

      <label className="login-field">
        <span>{t('addressLineLabel')}</span>
        <input type="text" value={line} onChange={(e) => setLine(e.target.value)} required />
      </label>
      <label className="login-field">
        <span>{t('provinceLabel')}</span>
        <SearchableSelect
          value={provinceCode}
          onChange={handleProvinceChange}
          options={provinceOptions}
          placeholder={t('selectPlaceholder')}
          noResultsText={tCommon('noResultsFound')}
        />
      </label>
      <label className="login-field">
        <span>{t('wardLabel')}</span>
        <SearchableSelect
          value={wardCode}
          onChange={setWardCode}
          options={wardOptions}
          placeholder={selectedProvince ? t('selectPlaceholder') : t('selectProvinceFirst')}
          noResultsText={tCommon('noResultsFound')}
          disabled={!selectedProvince}
        />
      </label>

      <div className="login-field">
        <span>{t('locationLabel')}</span>
        <div className="map-link-row">
          <input
            type="url"
            placeholder={t('mapLinkPlaceholder')}
            value={mapLink}
            onChange={(e) => {
              const value = e.target.value;
              setMapLink(value);
              if (value.trim() !== resolvedLink) setLinkStatus('idle');
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted) {
                // Without this, the browser's own default paste ALSO inserts
                // the clipboard text into the field on top of the value this
                // sets via state — the exact "link duplicated in the input"
                // bug reported (both writes land in the same uncontrolled
                // instant, so React's controlled re-render doesn't get a
                // chance to be the only writer).
                e.preventDefault();
                setMapLink(pasted);
                void resolveMapLink(pasted);
              }
            }}
            onBlur={() => {
              if (linkStatus === 'idle' && mapLink.trim() !== resolvedLink) void resolveMapLink(mapLink);
            }}
          />
          <button
            type="button"
            className="map-link-apply-btn"
            disabled={!mapLink.trim() || linkStatus === 'resolving'}
            onClick={() => void resolveMapLink(mapLink)}
          >
            {linkStatus === 'resolving' ? t('mapLinkResolving') : t('mapLinkApply')}
          </button>
        </div>
        {linkStatus === 'resolved' ? (
          <p className="write-review-error" style={{ color: 'var(--color-open-fg)' }} role="status">
            {t('mapLinkResolved', { lat: Number(lat).toFixed(5), lng: Number(lng).toFixed(5) })}
          </p>
        ) : null}
        {linkStatus === 'error' ? (
          <p className="write-review-error" role="alert">
            {t('mapLinkError')}
          </p>
        ) : null}
        <button type="button" className="use-location-btn" disabled={geoStatus === 'locating'} onClick={useMyLocation}>
          <LocateIcon size={16} />
          {geoStatus === 'locating' ? t('useMyLocationLocating') : t('useMyLocation')}
        </button>
        {geoStatus === 'denied' ? (
          <p className="write-review-error" role="alert">
            {t('useMyLocationDenied')}
          </p>
        ) : null}
        {geoStatus === 'unsupported' ? (
          <p className="write-review-error" role="alert">
            {t('useMyLocationUnsupported')}
          </p>
        ) : null}
        {geoStatus === 'error' ? (
          <p className="write-review-error" role="alert">
            {t('useMyLocationError')}
          </p>
        ) : null}
      </div>

      <div className="login-field">
        <span>{t('photosLabel')}</span>
        <PhotoUploadField
          photos={photos}
          onChange={setPhotos}
          ownerType="restaurant"
          coverUrl={coverUrl}
          onCoverChange={setCoverUrl}
          maxPhotos={20}
        />
      </div>

      <div className="filter-toggle-row">
        <div className="filter-toggle-text">
          <span className="filter-toggle-title">{t('openingHoursLabel')}</span>
          <span className="filter-toggle-sub">{t('openingHoursSubLabel')}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hasOpeningHours}
          aria-label={t('openingHoursLabel')}
          className={`toggle-switch ${hasOpeningHours ? 'toggle-switch-on' : 'toggle-switch-off'}`}
          onClick={() => setHasOpeningHours((v) => !v)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      {hasOpeningHours && (
        <div className="opening-hours-fields">
          <div className="opening-hours-time-row">
            <label className="login-field">
              <span>{t('openingHoursOpenLabel')}</span>
              <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
            </label>
            <label className="login-field">
              <span>{t('openingHoursCloseLabel')}</span>
              <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </label>
          </div>
          <span className="opening-hours-days-label">{t('openingHoursClosedDaysLabel')}</span>
          <div className="chip-row">
            {Array.from({ length: 7 }, (_, dayOfWeek) => (
              <button
                key={dayOfWeek}
                type="button"
                className={`chip chip-toggle ${closedDays.includes(dayOfWeek) ? 'chip-selected' : ''}`}
                onClick={() => toggleClosedDay(dayOfWeek)}
              >
                {tLabels(`day.${dayOfWeek}`)}
              </button>
            ))}
          </div>
          {allDaysMarkedClosed ? (
            <p className="write-review-error" role="alert">
              {t('openingHoursAllClosedError')}
            </p>
          ) : null}
        </div>
      )}

      <button type="submit" className="write-review-submit" disabled={isSubmitting || !canSubmit}>
        {isSubmitting ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
