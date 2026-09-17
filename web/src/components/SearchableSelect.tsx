'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  noResultsText: string;
  disabled?: boolean;
  /** Renders a hidden `<input>` too, so a plain (no-JS) form submit still sends this field. */
  name?: string;
  required?: boolean;
}

// Strips diacritics so typing "vung tau" (no dấu — how most Vietnamese
// speakers actually type when searching) still matches "Vũng Tàu". `Đ/đ`
// isn't decomposable via NFD (it's its own code point, not base+combining
// mark), so it needs its own replace pass.
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * A dependency-free searchable dropdown — replaces a plain `<select>` for
 * the Province/Ward fields (34 provinces is tolerable in a native select,
 * but some provinces have 300+ wards, where scrolling a native dropdown is
 * genuinely painful). Structured as a text input + absolutely-positioned
 * listbox rather than `<input list="...">` (`<datalist>`) because a
 * datalist can't be constrained to only the listed values — this needs to
 * guarantee the submitted value is a real dataset code, not arbitrary text.
 */
export function SearchableSelect({ value, onChange, options, placeholder, noResultsText, disabled, name, required }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = normalize(query);
    return options.filter((o) => normalize(o.label).includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlightIndex];
      if (option) selectOption(option);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className="searchable-select" ref={containerRef}>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <input
        type="text"
        value={open ? query : (selectedOption?.label ?? '')}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setHighlightIndex(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open ? (
        <div className="searchable-select-menu" role="listbox">
          {filtered.length === 0 ? (
            <div className="searchable-select-empty">{noResultsText}</div>
          ) : (
            filtered.map((option, i) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={`searchable-select-option ${i === highlightIndex ? 'searchable-select-option-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
