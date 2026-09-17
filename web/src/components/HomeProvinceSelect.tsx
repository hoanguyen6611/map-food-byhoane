'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setHomeProvinceAction } from '@/app/[locale]/actions';
import { SearchableSelect } from '@/components/SearchableSelect';

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
}

/**
 * The `name="province"` here still participates in the parent hero form's
 * native submit (so "Tìm" still sends `province` to /search) — this
 * component's own `onChange` is a second, independent effect: it persists
 * the choice (`setHomeProvinceAction`, a cookie) and refreshes the route so
 * Home's own sections (Danh mục/Khu vực/Quán nổi bật) re-fetch scoped to it,
 * without waiting for "Tìm" to be clicked.
 */
export function HomeProvinceSelect({ value, defaultValue, defaultLabel, options, ariaLabel, noResultsText }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function handleChange(next: string) {
    setLocalValue(next);
    startTransition(() => {
      void setHomeProvinceAction(next).then(() => router.refresh());
    });
  }

  const selectOptions = [{ value: defaultValue, label: defaultLabel }, ...options.map((p) => ({ value: p.name, label: p.shortName }))];

  return (
    <SearchableSelect
      value={localValue}
      onChange={handleChange}
      options={selectOptions}
      placeholder={ariaLabel}
      noResultsText={noResultsText}
      name="province"
    />
  );
}
