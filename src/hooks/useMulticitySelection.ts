'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SelectedLeg, SelectedLegFlightData } from '@/types/models';

const STORAGE_KEY = 'multicity_selected_legs';

export function useMulticitySelection(totalLegs: number) {
  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([]);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SelectedLeg[];
        if (Array.isArray(parsed)) setSelectedLegs(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const selectLeg = useCallback(
    (
      legIndex: number,
      rawFlight: unknown,
      flightData: SelectedLegFlightData,
      legMeta: { origin: string; destination: string; date: string },
    ) => {
      setSelectedLegs((prev) => {
        const next = prev.filter((s) => s.legIndex !== legIndex);
        next.push({ legIndex, rawFlight, flightData, legMeta });
        next.sort((a, b) => a.legIndex - b.legIndex);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const clearLeg = useCallback((legIndex: number) => {
    setSelectedLegs((prev) => {
      const next = prev.filter((s) => s.legIndex !== legIndex);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLegs([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const isLegSelected = useCallback(
    (legIndex: number) => selectedLegs.some((s) => s.legIndex === legIndex),
    [selectedLegs],
  );

  const allLegsSelected = totalLegs > 0 && selectedLegs.length === totalLegs;

  return {
    selectedLegs,
    selectLeg,
    clearLeg,
    clearSelection,
    isLegSelected,
    allLegsSelected,
  };
}
