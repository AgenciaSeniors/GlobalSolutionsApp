/**
 * @fileoverview Admin Flights Management — CRUD + Markup Engine.
 *
 * Spec §3.1: Markup logic — base_price + % markup = final_price
 * Spec §4.1: Total = (Costo Base + Markup Agencia) + Comisión Pasarela
 * Spec §2.3: Admin has full control over prices and manual offer updates.
 *
 * The `final_price` column is GENERATED ALWAYS AS (base_price * (1 + markup_percentage / 100))
 * so we only write base_price + markup_percentage and Postgres computes the rest.
 */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Pencil,
  Trash2,
  Flame,
  TrendingUp,
  Plane,
  Search,
  DollarSign,
  Save,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

/* ---------- Types ---------- */
interface FlightRow {
  id: string;
  flight_number: string;
  base_price: number;
  markup_percentage: number;
  final_price: number;
  total_seats: number;
  available_seats: number;
  aircraft_type: string | null;
  baggage_included: string | null;
  departure_datetime: string;
  arrival_datetime: string;
  is_exclusive_offer: boolean;
  airline: { iata_code: string; name: string } | null;
  origin_airport: { iata_code: string; city: string } | null;
  destination_airport: { iata_code: string; city: string } | null;
}

interface AirlineOption {
  id: string;
  iata_code: string;
  name: string;
}

interface AirportOption {
  id: string;
  iata_code: string;
  city: string;
}

const EMPTY_FORM = {
  airline_id: '',
  flight_number: '',
  origin_airport_id: '',
  destination_airport_id: '',
  departure_datetime: '',
  arrival_datetime: '',
  base_price: '',
  markup_percentage: '10',
  total_seats: '180',
  available_seats: '180',
  aircraft_type: '',
  baggage_included: '23kg checked + 8kg carry-on',
  is_exclusive_offer: false,
};

export default function AdminFlightsPage() {
  const supabase = createClient();
  const { settings } = useAppSettings();

  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [airlines, setAirlines] = useState<AirlineOption[]>([]);
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form state
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global markup
  const [globalMarkup, setGlobalMarkup] = useState('');
  const [applyingGlobal, setApplyingGlobal] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [flightsRes, airlinesRes, airportsRes] = await Promise.all([
      supabase
        .from('flights')
        .select(
          `id, flight_number, base_price, markup_percentage, final_price,
           total_seats, available_seats, aircraft_type, baggage_included,
           departure_datetime, arrival_datetime, is_exclusive_offer,
           airline:airlines(iata_code, name),
           origin_airport:airports!origin_airport_id(iata_code, city),
           destination_airport:airports!destination_airport_id(iata_code, city)`
        )
        .order('departure_datetime', { ascending: true }),
      supabase.from('airlines').select('id, iata_code, name').eq('is_active', true).order('name'),
      supabase.from('airports').select('id, iata_code, city').order('city'),
    ]);

    setFlights((flightsRes.data as unknown as FlightRow[]) || []);
    setAirlines((airlinesRes.data as AirlineOption[]) || []);
    setAirports((airportsRes.data as AirportOption[]) || []);
    setLoading(false);
  }

  /* ---------- Helpers ---------- */
  const computePreview = (base: string, markup: string) => {
    const b = parseFloat(base) || 0;
    const m = parseFloat(markup) || 0;
    return (b * (1 + m / 100)).toFixed(2);
  };

  const updateField = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ---------- CRUD ---------- */
  function openCreate() {
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      markup_percentage: String(settings.default_markup_percentage),
    });
    setEditing(true);
    setError(null);
  }

  function openEdit(f: FlightRow) {
    setEditId(f.id);
    setForm({
      airline_id: '', // We don't have airline_id in the joined query, but we need it
      flight_number: f.flight_number,
      origin_airport_id: '',
      destination_airport_id: '',
      departure_datetime: f.departure_datetime.slice(0, 16), // datetime-local format
      arrival_datetime: f.arrival_datetime.slice(0, 16),
      base_price: String(f.base_price),
      markup_percentage: String(f.markup_percentage),
      total_seats: String(f.total_seats),
      available_seats: String(f.available_seats),
      aircraft_type: f.aircraft_type || '',
      baggage_included: f.baggage_included || '',
      is_exclusive_offer: f.is_exclusive_offer,
    });
    setEditing(true);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const markupVal = parseFloat(form.markup_percentage);
    if (markupVal < settings.min_markup_percentage || markupVal > settings.max_markup_percentage) {
      setError(
        `El markup debe estar entre ${settings.min_markup_percentage}% y ${settings.max_markup_percentage}% (configurado en Ajustes).`
      );
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      flight_number: form.flight_number.trim().toUpperCase(),
      departure_datetime: form.departure_datetime,
      arrival_datetime: form.arrival_datetime,
      base_price: parseFloat(form.base_price),
      markup_percentage: markupVal,
      total_seats: parseInt(form.total_seats),
      available_seats: parseInt(form.available_seats),
      aircraft_type: form.aircraft_type || null,
      baggage_included: form.baggage_included || null,
      is_exclusive_offer: form.is_exclusive_offer,
    };

    // Only set FK fields for new records
    if (!editId) {
      if (!form.airline_id || !form.origin_airport_id || !form.destination_airport_id) {
        setError('Selecciona aerolínea, origen y destino.');
        setSaving(false);
        return;
      }
      payload.airline_id = form.airline_id;
      payload.origin_airport_id = form.origin_airport_id;
      payload.destination_airport_id = form.destination_airport_id;
    }

    try {
      if (editId) {
        const { error: err } = await supabase.from('flights').update(payload).eq('id', editId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('flights').insert(payload);
        if (err) throw err;
      }
      setEditing(false);
      setEditId(null);
      fetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este vuelo? Esta acción no se puede deshacer.')) return;
    await supabase.from('flights').delete().eq('id', id);
    fetchAll();
  }

  async function toggleOffer(id: string, current: boolean) {
    await supabase.from('flights').update({ is_exclusive_offer: !current }).eq('id', id);
    fetchAll();
  }

  /* ---------- Global Markup ---------- */
  async function applyGlobalMarkup() {
    const markup = parseFloat(globalMarkup);
    if (isNaN(markup) || markup < settings.min_markup_percentage || markup > settings.max_markup_percentage) {
      setError(`El markup global debe estar entre ${settings.min_markup_percentage}% y ${settings.max_markup_percentage}%`);
      return;
    }
    if (!confirm(`¿Aplicar ${markup}% de markup a TODOS los vuelos con disponibilidad?`)) return;
    setApplyingGlobal(true);
    setError(null);
    await supabase.from('flights').update({ markup_percentage: markup }).gt('available_seats', 0);
    setApplyingGlobal(false);
    setGlobalMarkup('');
    fetchAll();
  }

  /* ---------- Filtered list ---------- */
  const filtered = flights.filter((f) => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (
      f.flight_number.toLowerCase().includes(s) ||
      f.airline?.name.toLowerCase().includes(s) ||
      f.origin_airport?.city.toLowerCase().includes(s) ||
      f.destination_airport?.city.toLowerCase().includes(s) ||
      f.origin_airport?.iata_code.toLowerCase().includes(s) ||
      f.destination_airport?.iata_code.toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 overflow-auto">
        <Header
          title="Gestión de Vuelos"
          subtitle="Crear, editar, markup y disponibilidad"
        />
        <div className="p-6 lg:p-8">
          {/* Top bar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar vuelo, aerolínea, ciudad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={openCreate} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nuevo Vuelo
              </Button>
            </div>
          </div>

          {/* Global Markup Tool */}
          <Card variant="bordered" className="mb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-neutral-800">Markup Global</h3>
              </div>
              <p className="text-xs text-neutral-500 sm:flex-1">
                Aplica un porcentaje de ganancia a <strong>todos</strong> los vuelos con
                disponibilidad. Rango permitido:{' '}
                <span className="font-semibold text-neutral-700">
                  {settings.min_markup_percentage}% — {settings.max_markup_percentage}%
                </span>{' '}
                (configurable en{' '}
                <a href="/admin/dashboard/settings" className="text-brand-600 underline">
                  Ajustes
                </a>
                )
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={settings.min_markup_percentage}
                  max={settings.max_markup_percentage}
                  step="0.5"
                  placeholder={`Ej: ${settings.default_markup_percentage}`}
                  value={globalMarkup}
                  onChange={(e) => setGlobalMarkup(e.target.value)}
                  className="w-24 rounded-lg border-2 border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <span className="text-sm text-neutral-500">%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={applyGlobalMarkup}
                  isLoading={applyingGlobal}
                  disabled={!globalMarkup}
                >
                  Aplicar a todos
                </Button>
              </div>
            </div>
          </Card>

          {/* Top-level error (e.g. global markup validation) */}
          {error && !editing && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Form */}
          {editing && (
            <Card className="mb-6 border-2 border-brand-200 bg-brand-50/30">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Plane className="h-5 w-5 text-brand-600" />
                  {editId ? 'Editar Vuelo' : 'Nuevo Vuelo'}
                </h3>
                <button onClick={() => setEditing(false)} className="rounded-lg p-2 hover:bg-neutral-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Airline */}
                  {!editId && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-neutral-700">
                        Aerolínea
                      </label>
                      <select
                        value={form.airline_id}
                        onChange={(e) => updateField('airline_id', e.target.value)}
                        className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                        required={!editId}
                      >
                        <option value="">Seleccionar...</option>
                        {airlines.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.iata_code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="n_de_vuelo" className="mb-1 block text-sm font-medium text-neutral-700">
                      Nº de Vuelo
                    </label>
                    <Input
placeholder="TK1800"
                    value={form.flight_number}
                    onChange={(e) => updateField('flight_number', e.target.value)}
                    required
                    id="n_de_vuelo"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="tipo_de_aeronave" className="mb-1 block text-sm font-medium text-neutral-700">
                      Tipo de Aeronave
                    </label>
                    <Input
placeholder="Boeing 777-300ER"
                    value={form.aircraft_type}
                    onChange={(e) => updateField('aircraft_type', e.target.value)}
                    id="tipo_de_aeronave"
                    />
                  </div>

                  {/* Origin/Destination */}
                  {!editId && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-neutral-700">
                          Origen
                        </label>
                        <select
                          value={form.origin_airport_id}
                          onChange={(e) => updateField('origin_airport_id', e.target.value)}
                          className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                          required={!editId}
                        >
                          <option value="">Seleccionar...</option>
                          {airports.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.iata_code} — {a.city}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-neutral-700">
                          Destino
                        </label>
                        <select
                          value={form.destination_airport_id}
                          onChange={(e) => updateField('destination_airport_id', e.target.value)}
                          className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                          required={!editId}
                        >
                          <option value="">Seleccionar...</option>
                          {airports.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.iata_code} — {a.city}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="salida" className="mb-1 block text-sm font-medium text-neutral-700">
                      Salida
                    </label>
                    <Input
type="datetime-local"
                    value={form.departure_datetime}
                    onChange={(e) => updateField('departure_datetime', e.target.value)}
                    required
                    id="salida"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="llegada" className="mb-1 block text-sm font-medium text-neutral-700">
                      Llegada
                    </label>
                    <Input
type="datetime-local"
                    value={form.arrival_datetime}
                    onChange={(e) => updateField('arrival_datetime', e.target.value)}
                    required
                    id="llegada"
                    />
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <DollarSign className="h-4 w-4" /> Motor de Precios (Markup)
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="space-y-1">
                      <label htmlFor="precio_base" className="mb-1 block text-sm font-medium text-neutral-700">
                        Precio Base ($)
                      </label>
                      <Input
type="number"
                      min="0"
                      step="0.01"
                      placeholder="1050.00"
                      value={form.base_price}
                      onChange={(e) => updateField('base_price', e.target.value)}
                      required
                      id="precio_base"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="markup" className="mb-1 block text-sm font-medium text-neutral-700">
                        Markup (%)
                      </label>
                      <Input
type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="10"
                      value={form.markup_percentage}
                      onChange={(e) => updateField('markup_percentage', e.target.value)}
                      required
                      id="markup"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-emerald-700">
                        Precio Final (automático)
                      </label>
                      <div className="flex h-[50px] items-center rounded-xl border-2 border-emerald-300 bg-emerald-100 px-4 text-lg font-bold text-emerald-800">
                        ${computePreview(form.base_price, form.markup_percentage)}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-neutral-500">
                        Ganancia por boleto
                      </label>
                      <div className="flex h-[50px] items-center rounded-xl bg-neutral-100 px-4 text-lg font-bold text-neutral-600">
                        +${(
                          parseFloat(computePreview(form.base_price, form.markup_percentage)) -
                          (parseFloat(form.base_price) || 0)
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seats + Baggage */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label htmlFor="total_asientos" className="mb-1 block text-sm font-medium text-neutral-700">
                      Total Asientos
                    </label>
                    <Input
type="number"
                    min="1"
                    value={form.total_seats}
                    onChange={(e) => updateField('total_seats', e.target.value)}
                    required
                    id="total_asientos"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="asientos_disponibles" className="mb-1 block text-sm font-medium text-neutral-700">
                      Asientos Disponibles
                    </label>
                    <Input
type="number"
                    min="0"
                    value={form.available_seats}
                    onChange={(e) => updateField('available_seats', e.target.value)}
                    required
                    id="asientos_disponibles"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="equipaje_incluido" className="mb-1 block text-sm font-medium text-neutral-700">
                      Equipaje Incluido
                    </label>
                    <Input
placeholder="23kg checked + 8kg carry-on"
                    value={form.baggage_included}
                    onChange={(e) => updateField('baggage_included', e.target.value)}
                    id="equipaje_incluido"
                    />
                  </div>
                </div>

                {/* Flags */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_exclusive_offer}
                    onChange={(e) => updateField('is_exclusive_offer', e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-600"
                  />
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Marcar como Oferta Exclusiva</span>
                </label>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button type="submit" isLoading={saving} className="gap-1.5">
                    <Save className="h-4 w-4" /> {editId ? 'Actualizar Vuelo' : 'Crear Vuelo'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Flights Table */}
          {loading ? (
            <p className="text-neutral-500">Cargando vuelos...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-3">Vuelo</th>
                    <th className="px-3 py-3">Aerolínea</th>
                    <th className="px-3 py-3">Ruta</th>
                    <th className="px-3 py-3">Salida</th>
                    <th className="px-3 py-3">Base</th>
                    <th className="px-3 py-3">Markup</th>
                    <th className="px-3 py-3">P. Final</th>
                    <th className="px-3 py-3">Asientos</th>
                    <th className="px-3 py-3">Aeronave</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                        {search ? 'Sin resultados para la búsqueda' : 'No hay vuelos registrados'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((f) => (
                      <tr key={f.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold">{f.flight_number}</span>
                            {f.is_exclusive_offer && (
                              <Flame className="h-3.5 w-3.5 text-orange-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-neutral-600">
                          {f.airline?.iata_code} — {f.airline?.name}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {f.origin_airport?.iata_code} → {f.destination_airport?.iata_code}
                        </td>
                        <td className="px-3 py-3 text-xs text-neutral-500">
                          {new Date(f.departure_datetime).toLocaleDateString('es', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-3 text-neutral-600">${f.base_price.toFixed(2)}</td>
                        <td className="px-3 py-3">
                          <Badge variant="default">{f.markup_percentage}%</Badge>
                        </td>
                        <td className="px-3 py-3 font-bold text-emerald-600">
                          ${f.final_price.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={
                              f.available_seats < 10
                                ? 'font-bold text-red-600'
                                : 'text-neutral-600'
                            }
                          >
                            {f.available_seats}/{f.total_seats}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-neutral-500">
                          {f.aircraft_type || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(f)}
                              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-brand-600"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleOffer(f.id, f.is_exclusive_offer)}
                              className="rounded-lg p-1.5 text-neutral-400 hover:bg-amber-50 hover:text-amber-600"
                              title={f.is_exclusive_offer ? 'Quitar oferta' : 'Marcar oferta'}
                            >
                              <Flame className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
