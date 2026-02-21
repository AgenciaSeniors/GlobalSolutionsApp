/**
 * @fileoverview Airport autocomplete input with debounced search.
 * Type a country, city or code and get matching airport suggestions.
 * Can resolve an IATA code to its display label on mount.
 * @module components/forms/AirportAutocomplete
 */
'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';

type AirportOption = {
  code: string;
  name: string;
  city: string;
  country: string;
  label: string;
};

type Props = {
  value: string;             // IATA code selected
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Codes to exclude from results (e.g. already-selected airport) */
  excludeCodes?: string[];
  className?: string;
  /** Unique identifier for testing */
  testId?: string;
};

export default function AirportAutocomplete({
  value,
  onChange,
  placeholder = 'Escribe país, ciudad o código',
  required,
  disabled,
  excludeCodes = [],
  className,
  testId,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<AirportOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [resolvedCode, setResolvedCode] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Resolve an IATA code to its display label on mount or when value changes externally
  useEffect(() => {
    if (!value) {
      setInputValue('');
      setResolvedCode(null);
      return;
    }

    // Already resolved this code
    if (resolvedCode === value && inputValue) return;

    // Check if we already have this in our cached options
    const cached = options.find((o) => o.code === value);
    if (cached) {
      setInputValue(cached.label);
      setResolvedCode(value);
      return;
    }

    // Fetch the airport info for this code
    const controller = new AbortController();

    fetch(`/api/flights/autocomplete?query=${encodeURIComponent(value)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        const match = (json.results ?? []).find(
          (o: AirportOption) => o.code === value
        );
        if (match) {
          setInputValue(match.label);
          setResolvedCode(value);
        } else {
          // Fallback: just show the code
          setInputValue(value);
          setResolvedCode(value);
        }
      })
      .catch(() => {
        // Fallback on error
        setInputValue(value);
        setResolvedCode(value);
      });

    return () => controller.abort();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setOptions([]);
        setIsOpen(false);
        return;
      }

      // Cancel previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);

      try {
        const res = await fetch(
          `/api/flights/autocomplete?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const json = await res.json();

        if (controller.signal.aborted) return;

        const excludeSet = new Set(excludeCodes);
        const filtered = (json.results ?? []).filter(
          (o: AirportOption) => !excludeSet.has(o.code)
        );

        setOptions(filtered);
        setIsOpen(filtered.length > 0);
        setHighlightedIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[AirportAutocomplete] fetch error:', err);
        setOptions([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [excludeCodes]
  );

  function handleInputChange(text: string) {
    setInputValue(text);
    setResolvedCode(null);

    // If user clears input, clear selection
    if (!text.trim()) {
      onChange('');
      setOptions([]);
      setIsOpen(false);
      return;
    }

    // Debounce the search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(text.trim());
    }, 250);
  }

  function selectOption(option: AirportOption) {
    onChange(option.code);
    setInputValue(option.label);
    setResolvedCode(option.code);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || options.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        selectOption(options[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  function handleFocus() {
    if (resolvedCode) {
      // Re-fetch suggestions when user focuses a confirmed selection so they can change it
      void fetchSuggestions(inputValue);
    } else if (options.length > 0 && inputValue.length >= 2) {
      setIsOpen(true);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        data-testid={testId}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        className={
          className ??
          `w-full rounded-xl border-2 bg-neutral-50 px-4 py-3 text-[15px]
           focus:outline-none focus:ring-2 focus:ring-brand-500/20
           ${resolvedCode
             ? 'border-brand-400 focus:border-brand-500'
             : 'border-neutral-200 focus:border-brand-500'
           }`
        }
      />

      {/* Badge: airport confirmed indicator */}
      {resolvedCode && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">
          {resolvedCode}
        </span>
      )}

      {/* Hidden input to hold the actual IATA code for form validation */}
      <input type="hidden" value={value} />

      {/* Loading indicator — shown only when no resolvedCode badge is visible */}
      {isLoading && !resolvedCode && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && options.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-neutral-200
                     bg-white py-1 shadow-lg"
          role="listbox"
        >
          {options.map((option, idx) => (
            <li
              key={option.code}
              role="option"
              aria-selected={highlightedIndex === idx}
              onClick={() => selectOption(option)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                highlightedIndex === idx
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <span className="font-semibold">{option.city}</span>
              <span className="ml-1 text-neutral-500">
                ({option.code})
              </span>
              <span className="ml-1 text-neutral-400">– {option.country}</span>
              <div className="text-xs text-neutral-400">{option.name}</div>
            </li>
          ))}
        </ul>
      )}

      {/* No results message */}
      {isOpen && options.length === 0 && !isLoading && inputValue.length >= 2 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200
                     bg-white px-4 py-3 text-sm text-neutral-500 shadow-lg"
        >
          No se encontraron aeropuertos
        </div>
      )}
    </div>
  );
}