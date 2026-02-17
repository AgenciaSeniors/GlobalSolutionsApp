"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Plane, Building2, Loader2 } from "lucide-react";

interface AutocompletePlace {
  entityId: string;
  skyId: string;
  entityType: "AIRPORT" | "CITY" | "COUNTRY";
  name: string;
  iata: string;
  city: string;
  country: string;
  parentId: string | null;
}

interface AirportAutocompleteProps {
  value: string;
  onChange: (iataCode: string, displayLabel: string) => void;
  placeholder?: string;
  required?: boolean;
  label?: string;
  id?: string;
}

function displayLabel(place: AutocompletePlace): string {
  if (place.entityType === "AIRPORT") {
    return `${place.name} (${place.iata}) – ${place.country}`;
  }
  return `${place.name} (${place.iata}) – ${place.country}`;
}

function groupIcon(type: string) {
  switch (type) {
    case "AIRPORT":
      return <Plane className="h-4 w-4 text-brand-500" />;
    case "CITY":
      return <Building2 className="h-4 w-4 text-amber-500" />;
    default:
      return <MapPin className="h-4 w-4 text-neutral-400" />;
  }
}

function groupLabel(type: string): string {
  switch (type) {
    case "AIRPORT":
      return "Aeropuertos";
    case "CITY":
      return "Ciudades (todos los aeropuertos)";
    default:
      return "Otros";
  }
}

export default function AirportAutocomplete({
  value,
  onChange,
  placeholder = "Escribe ciudad, país o código IATA...",
  required = false,
  label,
  id = "airport-autocomplete",
}: AirportAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [places, setPlaces] = useState<AutocompletePlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value && !hasSelected) {
      setInputValue(value);
    }
  }, [value, hasSelected]);

  const fetchPlaces = useCallback(async (query: string) => {
    if (query.length < 2) {
      setPlaces([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/flights/autocomplete?query=${encodeURIComponent(query)}`
      );
      const json = (await res.json()) as { places?: AutocompletePlace[] };
      const results = json.places ?? [];
      setPlaces(results);
      setIsOpen(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleInputChange(text: string) {
    setInputValue(text);
    setHasSelected(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchPlaces(text);
    }, 300);
  }

  function selectPlace(place: AutocompletePlace) {
    const lbl = displayLabel(place);
    setInputValue(lbl);
    setHasSelected(true);
    setIsOpen(false);
    setPlaces([]);
    onChange(place.iata || place.skyId, lbl);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || places.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, places.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectPlace(places[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const activeItem = items[activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const grouped = places.reduce<Record<string, AutocompletePlace[]>>(
    (acc, place) => {
      const key = place.entityType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(place);
      return acc;
    },
    {}
  );

  const groupOrder = ["AIRPORT", "CITY", "COUNTRY"];

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label
          htmlFor={id}
          className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-700"
        >
          <MapPin className="h-3.5 w-3.5 text-brand-500" />
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={
            activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (places.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 pr-10 text-[15px]
                     focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                     transition-colors"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          </div>
        )}
      </div>

      {isOpen && places.length > 0 && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/10"
        >
          {groupOrder.map((groupType) => {
            const items = grouped[groupType];
            if (!items || items.length === 0) return null;

            return (
              <li key={groupType}>
                <div className="sticky top-0 flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/95 px-4 py-2 backdrop-blur-sm">
                  {groupIcon(groupType)}
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {groupLabel(groupType)}
                  </span>
                </div>

                <ul>
                  {items.map((place) => {
                    const flatIndex = places.indexOf(place);
                    const isActive = flatIndex === activeIndex;

                    return (
                      <li
                        key={`${place.entityId}-${place.iata}`}
                        id={`${id}-option-${flatIndex}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectPlace(place);
                        }}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                          <span className="text-xs font-bold text-neutral-600">
                            {place.iata || "—"}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{place.name}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {place.city}
                            {place.country ? `, ${place.country}` : ""}
                          </p>
                        </div>

                        {place.entityType === "CITY" && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Todos
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}