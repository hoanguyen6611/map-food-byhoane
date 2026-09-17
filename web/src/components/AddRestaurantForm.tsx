'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitContributionAction } from '@/app/[locale]/add-restaurant/actions';
import { PhotoUploadField, type UploadedPhoto } from '@/components/PhotoUploadField';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CATEGORY_OPTIONS, CUISINE_OPTIONS, PRICE_BUCKETS } from '@/lib/labels';
import { VN_PROVINCES, type CuisineCode, type DuplicateCandidateDto } from '@foodmap/shared-types';

type Phase =
  | { kind: 'form' }
  | { kind: 'duplicate'; candidates: DuplicateCandidateDto[] }
  | { kind: 'done'; status: 'auto_approved' | 'in_review' }
  | { kind: 'error'; message: string };

export function AddRestaurantForm() {
  const t = useTranslations('addRestaurant');
  const tLabels = useTranslations('labels');
  const tCommon = useTranslations('common');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [priceRangeCode, setPriceRangeCode] = useState('');
  const [phone, setPhone] = useState('');
  const [cuisineCodes, setCuisineCodes] = useState<CuisineCode[]>([]);
  const [line, setLine] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setLat(String(position.coords.latitude));
      setLng(String(position.coords.longitude));
    });
  }

  function toggleCuisine(code: CuisineCode) {
    setCuisineCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
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

  const canSubmit =
    name.trim().length >= 2 &&
    categoryCode !== '' &&
    line.trim() !== '' &&
    provinceCode !== '' &&
    wardCode !== '' &&
    lat !== '' &&
    lng !== '' &&
    photos.length > 0;

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
      photoUrls: photos.map((p) => p.url),
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
          <button type="button" className="notification-mark-read" onClick={() => setPhase({ kind: 'form' })}>
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
          {CATEGORY_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {tLabels(`category.${code}`)}
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
          {CUISINE_OPTIONS.map((code) => (
            <button
              key={code}
              type="button"
              className={`chip chip-toggle ${cuisineCodes.includes(code) ? 'chip-selected' : ''}`}
              onClick={() => toggleCuisine(code)}
            >
              {tLabels(`cuisine.${code}`)}
            </button>
          ))}
        </div>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            step="any"
            placeholder={t('latPlaceholder')}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
          />
          <input
            type="number"
            step="any"
            placeholder={t('lngPlaceholder')}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
          />
        </div>
        <button type="button" className="notification-mark-read" style={{ alignSelf: 'flex-start' }} onClick={useMyLocation}>
          {t('useMyLocation')}
        </button>
      </div>

      <div className="login-field">
        <span>{t('photosLabel')}</span>
        <PhotoUploadField photos={photos} onChange={setPhotos} ownerType="restaurant" />
      </div>

      <button type="submit" className="write-review-submit" disabled={isSubmitting || !canSubmit}>
        {isSubmitting ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
