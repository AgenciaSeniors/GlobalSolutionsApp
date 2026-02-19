/**
 * @fileoverview Shared car form for admin create/edit.
 * @module components/features/cars/CarForm
 * @author Dev B
 */
'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { CAR_CATEGORIES, CATEGORY_LABELS, FUEL_TYPES, FUEL_LABELS, DEFAULT_SPECS } from '@/lib/cars/types';
import type { Car, CarSpecs, CarCategory } from '@/lib/cars/types';
import { Upload, X, Save, ArrowLeft } from 'lucide-react';

function isCarCategory(v: string): v is CarCategory {
  return (CAR_CATEGORIES as readonly string[]).includes(v);
}

function isTransmission(v: string): v is 'manual' | 'automatic' {
  return v === 'manual' || v === 'automatic';
}

interface Props {
  car?: Car | null;
  mode: 'create' | 'edit';
}

export default function CarForm({ car, mode }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(car?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Form state
  type FormState = {
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
    features: string;
    is_active: boolean;
  };

  const [form, setForm] = useState<FormState>({
    brand: car?.brand ?? '',
    model: car?.model ?? '',
    category: (car?.category ?? 'economy') as CarCategory,
    transmission: (car?.transmission ?? 'automatic') as 'manual' | 'automatic',
    passenger_capacity: car?.passenger_capacity ?? 5,
    luggage_capacity: car?.luggage_capacity ?? 2,
    daily_rate: car?.daily_rate ?? 0,
    available_units: car?.available_units ?? 1,
    description: car?.description ?? '',
    currency: car?.currency ?? 'USD',
    pickup_location: car?.pickup_location ?? 'La Habana',
    dropoff_location: car?.dropoff_location ?? '',
    supplier: car?.supplier ?? '',
    features: (car?.features ?? []).join(', '),
    is_active: car?.is_active ?? true,
  });

  const [specs, setSpecs] = useState<CarSpecs>(car?.specs ?? DEFAULT_SPECS);

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateSpec<K extends keyof CarSpecs>(field: K, value: CarSpecs[K]) {
    setSpecs((prev) => ({ ...prev, [field]: value }));
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede ser mayor a 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  async function uploadImage(carId: string): Promise<string | null> {
    if (!imageFile) return car?.image_url ?? null;

    const supabase = createClient();
    const ext = imageFile.name.split('.').pop() ?? 'jpg';
    const path = `cars/${carId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('car-images')
      .upload(path, imageFile, { upsert: true });

    if (uploadError) {
      console.error('[CarForm] Upload error:', uploadError);
      return car?.image_url ?? null;
    }

    const { data: urlData } = supabase.storage
      .from('car-images')
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const supabase = createClient();

      // Parse features from comma-separated string
      const features = form.features
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        category: form.category,
        transmission: form.transmission,
        passenger_capacity: Number.isFinite(form.passenger_capacity) ? form.passenger_capacity : 0,
        luggage_capacity: Number.isFinite(form.luggage_capacity) ? form.luggage_capacity : 0,
        daily_rate: Number.isFinite(form.daily_rate) ? form.daily_rate : 0,
        available_units: Number.isFinite(form.available_units) ? Math.max(1, form.available_units) : 1,
        description: form.description || null,
        currency: form.currency?.trim() || 'USD',
        pickup_location: form.pickup_location?.trim() || 'Mismo lugar de recogida',
        dropoff_location: form.dropoff_location || null,
        supplier: form.supplier || null,
        features,
        specs: specs ?? {},
        year: (specs as CarSpecs).year ?? null,
        is_active: form.is_active,
      };

      if (mode === 'create') {
        const { data, error: insertErr } = await supabase
          .from('car_rentals')
          .insert(payload)
          .select('id')
          .single();

        if (insertErr) throw new Error(insertErr.message);

        // Upload image if selected
        if (imageFile && data?.id) {
          const imageUrl = await uploadImage(data.id as string);
          if (imageUrl) {
            await supabase
              .from('car_rentals')
              .update({ image_url: imageUrl })
              .eq('id', data.id);
          }
        }
      } else if (car) {
        // Upload image first
        if (imageFile) {
          const imageUrl = await uploadImage(car.id);
          payload.image_url = imageUrl;
        } else if (!imagePreview) {
          payload.image_url = null;
        }

        const { error: updateErr } = await supabase
          .from('car_rentals')
          .update(payload)
          .eq('id', car.id);

        if (updateErr) throw new Error(updateErr.message);
      }

      router.push('/admin/dashboard/cars');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando auto');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-neutral-700';

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── Basic Info ─── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">Información Básica</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Marca *</label>
            <input className={inputClass} value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Modelo *</label>
            <input className={inputClass} value={form.model} onChange={(e) => updateForm('model', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Categoría *</label>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => {
                const v = e.target.value;
                if (isCarCategory(v)) updateForm('category', v);
              }}
            >
              {CAR_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Transmisión *</label>
            <select
              className={inputClass}
              value={form.transmission}
              onChange={(e) => {
                const v = e.target.value;
                if (isTransmission(v)) updateForm('transmission', v);
              }}
            >
              <option value="automatic">Automático</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Precio por día (USD) *</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              step={0.01}
              value={form.daily_rate}
              onChange={(e) => updateForm('daily_rate', Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Unidades disponibles</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={form.available_units}
              onChange={(e) => updateForm('available_units', Number.isFinite(e.target.valueAsNumber) ? Math.max(1, e.target.valueAsNumber) : 1)}
            />
          </div>
          <div>
            <label className={labelClass}>Pasajeros</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={15}
              value={form.passenger_capacity}
              onChange={(e) => updateForm('passenger_capacity', Number.isFinite(e.target.valueAsNumber) ? Math.max(1, e.target.valueAsNumber) : 1)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Maletas</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              value={form.luggage_capacity}
              onChange={(e) => updateForm('luggage_capacity', Number.isFinite(e.target.valueAsNumber) ? Math.max(0, e.target.valueAsNumber) : 0)}
              required
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Descripción</label>
          <textarea
            className={inputClass + ' min-h-[80px] resize-y'}
            value={form.description}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Descripción del vehículo para el público..."
          />
        </div>
      </div>

      {/* ─── Specs ─── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">Especificaciones Técnicas</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Asientos</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              max={15}
              value={Number(specs.seats ?? 0)}
              onChange={(e) => updateSpec('seats', (e.target.valueAsNumber as CarSpecs['seats']) ?? (specs.seats as CarSpecs['seats']))}
            />
          </div>
          <div>
            <label className={labelClass}>Puertas</label>
            <input
              className={inputClass}
              type="number"
              min={2}
              max={6}
              value={Number(specs.doors ?? 0)}
              onChange={(e) => updateSpec('doors', (e.target.valueAsNumber as CarSpecs['doors']) ?? (specs.doors as CarSpecs['doors']))}
            />
          </div>
          <div>
            <label className={labelClass}>Combustible</label>
            <select className={inputClass} value={specs.fuel} onChange={(e) => updateSpec('fuel', e.target.value)}>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>{FUEL_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Año</label>
            <input
              className={inputClass}
              type="number"
              min={2000}
              max={2030}
              value={Number(specs.year ?? 0)}
              onChange={(e) => updateSpec('year', (e.target.valueAsNumber as CarSpecs['year']) ?? (specs.year as CarSpecs['year']))}
            />
          </div>
          <div>
            <label className={labelClass}>Motor</label>
            <input className={inputClass} value={specs.engine} onChange={(e) => updateSpec('engine', e.target.value)} placeholder="1.6L" />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <input className={inputClass} value={specs.color} onChange={(e) => updateSpec('color', e.target.value)} placeholder="Blanco" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="ac"
              checked={specs.ac}
              onChange={(e) => updateSpec('ac', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600"
            />
            <label htmlFor="ac" className="text-sm font-medium text-neutral-700">Aire Acondicionado</label>
          </div>
        </div>
      </div>

      {/* ─── Location & Extras ─── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">Ubicación y Extras</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Lugar de recogida *</label>
            <input className={inputClass} value={form.pickup_location} onChange={(e) => updateForm('pickup_location', e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Lugar de devolución</label>
            <input className={inputClass} value={form.dropoff_location} onChange={(e) => updateForm('dropoff_location', e.target.value)} placeholder="Mismo lugar si vacío" />
          </div>
          <div>
            <label className={labelClass}>Proveedor</label>
            <input className={inputClass} value={form.supplier} onChange={(e) => updateForm('supplier', e.target.value)} placeholder="Empresa rentadora" />
          </div>
          <div>
            <label className={labelClass}>Características (separadas por coma)</label>
            <input className={inputClass} value={form.features} onChange={(e) => updateForm('features', e.target.value)} placeholder="A/C, Bluetooth, GPS, USB" />
          </div>
        </div>
      </div>

      {/* ─── Image ─── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-neutral-900">Imagen</h3>
        {imagePreview ? (
          <div className="relative inline-block">
            <Image
              src={imagePreview}
              alt="Preview"
              width={240}
              height={160}
              className="h-40 w-60 rounded-xl object-cover border border-neutral-200"
              unoptimized
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex h-40 w-60 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-brand-400 hover:bg-brand-50/30 transition-colors">
            <Upload className="h-8 w-8 text-neutral-400" />
            <span className="mt-2 text-sm text-neutral-500">Subir imagen</span>
            <span className="text-xs text-neutral-400">JPG, PNG, WebP · Max 5MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
          </label>
        )}
      </div>

      {/* ─── Status & Submit ─── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => updateForm('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-neutral-700">
              Publicado (visible en la página pública)
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/dashboard/cars')}>
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <Button type="submit" isLoading={saving}>
          <Save className="h-4 w-4" /> {mode === 'create' ? 'Crear Auto' : 'Guardar Cambios'}
        </Button>
      </div>
    </form>
  );
}
