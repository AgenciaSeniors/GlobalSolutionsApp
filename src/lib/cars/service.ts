/**
 * @fileoverview Car rental service — server-side data access layer.
 * All functions use Supabase server client (respects RLS).
 * @module lib/cars/service
 * @author Dev B
 */
import { createClient } from '@/lib/supabase/server';
import type { Car, CarSearchParams } from './types';

/* ─── Helpers ─── */

function mapRow(row: Record<string, unknown>): Car {
  return {
    id: String(row.id),
    brand: String(row.brand ?? ''),
    model: String(row.model ?? ''),
    category: String(row.category ?? 'economy') as Car['category'],
    transmission: String(row.transmission ?? 'automatic') as Car['transmission'],
    passenger_capacity: Number(row.passenger_capacity ?? 0),
    luggage_capacity: Number(row.luggage_capacity ?? 0),
    daily_rate: Number(row.daily_rate ?? 0),
    available_units: Number(row.available_units ?? 1),
    image_url: row.image_url ? String(row.image_url) : null,
    image_urls: Array.isArray(row.image_urls) ? row.image_urls.map(String) : [],
    features: Array.isArray(row.features) ? row.features.map(String) : [],
    is_active: Boolean(row.is_active),
    description: row.description ? String(row.description) : null,
    currency: String(row.currency ?? 'USD'),
    pickup_location: String(row.pickup_location ?? ''),
    dropoff_location: row.dropoff_location ? String(row.dropoff_location) : null,
    supplier: row.supplier ? String(row.supplier) : null,
    specs: typeof row.specs === 'object' && row.specs !== null ? (row.specs as Car['specs']) : {
      seats: 5, doors: 4, transmission: 'automatic', ac: true, fuel: 'gasoline', bags: 2, year: 2024, color: '', engine: '',
    },
    year: row.year ? Number(row.year) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

const SELECT_FIELDS = `
  id, brand, model, category, transmission, passenger_capacity, luggage_capacity,
  daily_rate, available_units, image_url, image_urls, features, is_active,
  description, currency, pickup_location, dropoff_location, supplier, specs, year,
  created_at, updated_at
`;

/* ─── Public queries ─── */

export async function searchCars(params: CarSearchParams = {}): Promise<Car[]> {
  const supabase = await createClient();

  let query = supabase
    .from('car_rentals')
    .select(SELECT_FIELDS)
    .eq('is_active', true)
    .order('daily_rate', { ascending: true });

  if (params.category) {
    query = query.eq('category', params.category);
  }
  if (params.transmission) {
    query = query.eq('transmission', params.transmission);
  }
  if (params.minPrice != null) {
    query = query.gte('daily_rate', params.minPrice);
  }
  if (params.maxPrice != null) {
    query = query.lte('daily_rate', params.maxPrice);
  }
  if (params.pickup_location) {
    query = query.ilike('pickup_location', `%${params.pickup_location}%`);
  }
  if (params.minSeats != null) {
    query = query.gte('passenger_capacity', params.minSeats);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[cars/service] searchCars error:', error);
    return [];
  }

  let cars = (data ?? []).map((row: unknown) => mapRow(row as Record<string, unknown>));

  // Filter by specs fields that can't be filtered in SQL easily
  if (params.ac != null) {
    cars = cars.filter((c) => c.specs?.ac === params.ac);
  }

  return cars;
}

export async function getCarById(id: string): Promise<Car | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('car_rentals')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/* ─── Admin CRUD ─── */

export async function getAllCarsAdmin(): Promise<Car[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('car_rentals')
    .select(SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[cars/service] getAllCarsAdmin error:', error);
    return [];
  }

  return (data ?? []).map((row: unknown) => mapRow(row as Record<string, unknown>));
}

export async function createCar(carData: Record<string, unknown>): Promise<{ data: Car | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('car_rentals')
    .insert(carData)
    .select(SELECT_FIELDS)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapRow(data as Record<string, unknown>), error: null };
}

export async function updateCar(id: string, carData: Record<string, unknown>): Promise<{ data: Car | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('car_rentals')
    .update(carData)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapRow(data as Record<string, unknown>), error: null };
}

export async function toggleCarActive(id: string, is_active: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('car_rentals')
    .update({ is_active })
    .eq('id', id);

  return { error: error?.message ?? null };
}

export async function deleteCar(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Soft delete: set is_active = false
  const { error } = await supabase
    .from('car_rentals')
    .update({ is_active: false })
    .eq('id', id);

  return { error: error?.message ?? null };
}
