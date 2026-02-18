/**
 * @fileoverview Car rental types for public and admin modules.
 * @module lib/cars/types
 * @author Dev B
 */

/* ─── Specs ─── */
export interface CarSpecs {
  seats: number;
  doors: number;
  transmission: 'manual' | 'automatic';
  ac: boolean;
  fuel: string;       // "gasoline" | "diesel" | "electric" | "hybrid"
  bags: number;
  year: number;
  color: string;
  engine: string;     // "1.6L", "2.0L Turbo", etc.
}

export const DEFAULT_SPECS: CarSpecs = {
  seats: 5,
  doors: 4,
  transmission: 'automatic',
  ac: true,
  fuel: 'gasoline',
  bags: 2,
  year: 2024,
  color: '',
  engine: '',
};

/* ─── Car categories ─── */
export const CAR_CATEGORIES = [
  'economy',
  'compact',
  'midsize',
  'suv',
  'van',
  'luxury',
  'convertible',
] as const;

export type CarCategory = (typeof CAR_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CarCategory, string> = {
  economy: 'Económico',
  compact: 'Compacto',
  midsize: 'Mediano',
  suv: 'SUV',
  van: 'Van',
  luxury: 'Lujo',
  convertible: 'Convertible',
};

/* ─── Fuel types ─── */
export const FUEL_TYPES = ['gasoline', 'diesel', 'electric', 'hybrid'] as const;
export const FUEL_LABELS: Record<string, string> = {
  gasoline: 'Gasolina',
  diesel: 'Diésel',
  electric: 'Eléctrico',
  hybrid: 'Híbrido',
};

/* ─── Car model ─── */
export interface Car {
  id: string;
  brand: string;
  model: string;
  category: CarCategory;
  transmission: 'manual' | 'automatic';
  passenger_capacity: number;
  luggage_capacity: number;
  daily_rate: number;
  available_units: number;
  image_url: string | null;
  image_urls: string[];
  features: string[];
  is_active: boolean;
  description: string | null;
  currency: string;
  pickup_location: string;
  dropoff_location: string | null;
  supplier: string | null;
  specs: CarSpecs;
  year: number | null;
  created_at: string;
  updated_at: string;
}

/* ─── Search params (public filters) ─── */
export interface CarSearchParams {
  category?: CarCategory;
  transmission?: 'manual' | 'automatic';
  minPrice?: number;
  maxPrice?: number;
  minSeats?: number;
  ac?: boolean;
  pickup_location?: string;
}

/* ─── Admin form data ─── */
export interface CarFormData {
  brand: string;
  model: string;
  category: CarCategory;
  transmission: 'manual' | 'automatic';
  passenger_capacity: number;
  luggage_capacity: number;
  daily_rate: number;
  available_units: number;
  description: string;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  supplier: string;
  features: string[];
  specs: CarSpecs;
  is_active: boolean;
}
