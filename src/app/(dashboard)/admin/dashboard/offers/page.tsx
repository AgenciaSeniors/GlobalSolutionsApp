/**
 * @fileoverview Admin Offers Management — Visual offer engine with full flight details.
 * Admin can configure: destination, airline, airports, flight times, stops, aircraft,
 * cabin class, baggage, pricing, dates, urgency tags, and images.
 * @module app/(dashboard)/admin/dashboard/offers/page
 */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import OfferDatePicker from '@/components/ui/OfferDatePicker';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Tag,
  Flame,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Plane,
  MapPin,
  Clock,
  CircleDot,
  X,
  Search,
  ChevronDown,
} from 'lucide-react';
import type { SpecialOffer, SpecialOfferStop } from '@/types/models';

const TAG_OPTIONS = [
  { value: 'exclusive', label: 'Exclusivo', color: 'bg-brand-100 text-brand-700' },
  { value: 'flash_24h', label: 'Flash 24h', color: 'bg-red-100 text-red-700' },
  { value: 'fire', label: '🔥 Fuego', color: 'bg-orange-100 text-orange-700' },
  { value: 'few_seats', label: 'Pocos cupos', color: 'bg-amber-100 text-amber-700' },
];

const CABIN_OPTIONS = [
  { value: 'economy', label: 'Económica' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'Primera Clase' },
];

interface AirlineOption {
  id: string;
  iata_code: string;
  name: string;
  logo_url: string | null;
}

interface AirportOption {
  id: string;
  iata_code: string;
  name: string;
  city: string;
  country: string;
}

export default function AdminOffersPage() {
  const supabase = createClient();
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Reference data
  const [airlines, setAirlines] = useState<AirlineOption[]>([]);
  const [airports, setAirports] = useState<AirportOption[]>([]);

  // --- Form state: Destination ---
  const [destination, setDestination] = useState('');
  const [destinationImg, setDestinationImg] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // --- Form state: Flight details ---
  const [airlineId, setAirlineId] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [originAirportId, setOriginAirportId] = useState('');
  const [destinationAirportId, setDestinationAirportId] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [flightDuration, setFlightDuration] = useState('');
  const [aircraftType, setAircraftType] = useState('');
  const [cabinClass, setCabinClass] = useState('economy');
  const [baggageIncluded, setBaggageIncluded] = useState('1 maleta de mano (10kg)');
  const [stops, setStops] = useState<SpecialOfferStop[]>([]);

  // --- Form state: Pricing ---
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [agentPrice, setAgentPrice] = useState('');

  // --- Form state: Availability ---
  const [validDates, setValidDates] = useState('');
  const [maxSeats, setMaxSeats] = useState('20');
  const [urgencyLabel, setUrgencyLabel] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Airline combobox search state
  const [airlineSearch, setAirlineSearch] = useState('');
  const [airlineDropdownOpen, setAirlineDropdownOpen] = useState(false);
  const [customAirlineName, setCustomAirlineName] = useState('');

  useEffect(() => {
    fetchOffers();
    fetchReferenceData();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function fetchReferenceData() {
    const [airlinesRes, airportsRes] = await Promise.all([
      supabase.from('airlines').select('id, iata_code, name, logo_url').order('name'),
      supabase.from('airports').select('id, iata_code, name, city, country').order('city'),
    ]);
    setAirlines((airlinesRes.data as AirlineOption[]) ?? []);
    setAirports((airportsRes.data as AirportOption[]) ?? []);
  }

  async function fetchOffers() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from('special_offers')
      .select('*, airline:airlines(id, iata_code, name, logo_url), origin_airport:airports!origin_airport_id(id, iata_code, city), destination_airport:airports!destination_airport_id(id, iata_code, city)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchOffers error:', error);
      setOffers([]);
      setErrorMsg(error.message);
    } else {
      setOffers((data as SpecialOffer[]) || []);
    }

    setLoading(false);
  }

  function resetForm() {
    setDestination('');
    setDestinationImg('');
    setImageFile(null);
    setImagePreviewUrl(null);
    setAirlineId('');
    setFlightNumber('');
    setOriginAirportId('');
    setDestinationAirportId('');
    setOriginCity('');
    setDestinationCity('');
    setDepartureTime('');
    setArrivalTime('');
    setFlightDuration('');
    setAircraftType('');
    setCabinClass('economy');
    setBaggageIncluded('1 maleta de mano (10kg)');
    setStops([]);
    setOriginalPrice('');
    setOfferPrice('');
    setAgentPrice('');
    setValidDates('');
    setMaxSeats('20');
    setUrgencyLabel('');
    setSelectedTags([]);
    setEditingId(null);
    setAirlineSearch('');
    setAirlineDropdownOpen(false);
    setCustomAirlineName('');
  }

  function editOffer(offer: SpecialOffer) {
    setEditingId(offer.id);
    setDestination(offer.destination);
    setDestinationImg(offer.destination_img || '');
    setAirlineId(offer.airline_id || '');
    setFlightNumber(offer.flight_number || '');
    setOriginAirportId(offer.origin_airport_id || '');
    setDestinationAirportId(offer.destination_airport_id || '');
    setOriginCity(offer.origin_city || '');
    setDestinationCity(offer.destination_city || '');
    setDepartureTime(offer.departure_time?.slice(0, 5) || '');
    setArrivalTime(offer.arrival_time?.slice(0, 5) || '');
    setFlightDuration(offer.flight_duration || '');
    setAircraftType(offer.aircraft_type || '');
    setCabinClass(offer.cabin_class || 'economy');
    setBaggageIncluded(offer.baggage_included || '1 maleta de mano (10kg)');
    setStops((offer.stops as SpecialOfferStop[]) || []);
    setOriginalPrice(offer.original_price.toString());
    setOfferPrice(offer.offer_price.toString());
    setAgentPrice((offer.agent_price ?? '').toString());
    setValidDates(offer.valid_dates.join(', '));
    setUrgencyLabel(offer.urgency_label || '');
    setMaxSeats(offer.max_seats.toString());
    setSelectedTags(offer.tags);
    setCustomAirlineName((offer as unknown as { custom_airline_name?: string }).custom_airline_name || '');
    setImageFile(null);
    setImagePreviewUrl(null);
    setShowForm(true);
  }

  async function uploadOfferImage(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Solo se permiten imágenes');
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `special-offers/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('offer-images')
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('offer-images').getPublicUrl(path);
    return data.publicUrl;
  }

  function addStop() {
    setStops((prev) => [...prev, { city: '', airport_code: '', duration: '' }]);
  }

  function updateStop(index: number, field: keyof SpecialOfferStop, value: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const seats = parseInt(maxSeats);
    if (isNaN(seats) || seats < 1) {
      setErrorMsg('Max cupos debe ser al menos 1.');
      setSaving(false);
      return;
    }

    try {
      const dates = validDates
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      let finalImgUrl = destinationImg;
      if (imageFile) {
        finalImgUrl = await uploadOfferImage(imageFile);
        setDestinationImg(finalImgUrl);
      }

      // Clean stops: filter out empty rows
      const cleanStops = stops.filter((s) => s.city.trim() && s.airport_code.trim());

      const payload = {
        destination,
        destination_img: finalImgUrl || null,
        airline_id: airlineId || null,
        custom_airline_name: !airlineId && customAirlineName ? customAirlineName : null,
        flight_number: flightNumber || null,
        origin_airport_id: originAirportId || null,
        destination_airport_id: destinationAirportId || null,
        origin_city: originCity || null,
        destination_city: destinationCity || null,
        departure_time: departureTime || null,
        arrival_time: arrivalTime || null,
        flight_duration: flightDuration || null,
        aircraft_type: aircraftType || null,
        cabin_class: cabinClass || 'economy',
        baggage_included: baggageIncluded || null,
        stops: cleanStops,
        original_price: parseFloat(originalPrice),
        offer_price: parseFloat(offerPrice),
        agent_price: agentPrice ? parseFloat(agentPrice) : null,
        valid_dates: dates,
        urgency_label: urgencyLabel || null,
        max_seats: parseInt(maxSeats),
        tags: selectedTags,
      };

      const res = editingId
        ? await supabase.from('special_offers').update(payload).eq('id', editingId)
        : await supabase.from('special_offers').insert(payload);

      if (res.error) throw res.error;

      resetForm();
      setShowForm(false);
      await fetchOffers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error guardando la oferta';
      console.error(err);
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await supabase.from('special_offers').update({ is_active: !currentActive }).eq('id', id);
    fetchOffers();
  }

  async function deleteOffer(id: string) {
    if (confirm('¿Eliminar esta oferta?')) {
      await supabase.from('special_offers').delete().eq('id', id);
      fetchOffers();
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  // Auto-fill city when airport changes
  function handleOriginAirportChange(airportId: string) {
    setOriginAirportId(airportId);
    const airport = airports.find((a) => a.id === airportId);
    if (airport && !originCity) {
      setOriginCity(airport.city);
    }
  }

  function handleDestinationAirportChange(airportId: string) {
    setDestinationAirportId(airportId);
    const airport = airports.find((a) => a.id === airportId);
    if (airport && !destinationCity) {
      setDestinationCity(airport.city);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Ofertas Exclusivas" subtitle="Motor de ofertas — Vuelos, calendarios, imágenes, urgencia" />
        <div className="p-8">
          {/* Top bar */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Tag className="h-4 w-4" />
              {offers.length} ofertas totales · {offers.filter((o) => o.is_active).length} activas
            </div>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Nueva Oferta
            </Button>
          </div>

          {errorMsg && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* FORM                                   */}
          {/* ═══════════════════════════════════════ */}
          {showForm && (
            <Card variant="bordered" className="mb-8 border-brand-200 bg-brand-50/30">
              <h3 className="mb-6 text-lg font-bold">
                {editingId ? 'Editar Oferta' : 'Nueva Oferta Exclusiva'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── Section 1: Destino & Imagen ── */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-700">
                    <MapPin className="h-4 w-4" /> Destino
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Nombre del destino</label>
                      <Input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Estambul, Turquía"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Imagen del destino</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                      />
                      {(imagePreviewUrl || destinationImg) && (
                        <img
                          src={imagePreviewUrl || destinationImg}
                          alt="preview"
                          className="mt-2 h-24 w-full rounded-xl object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Detalles del Vuelo ── */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-700">
                    <Plane className="h-4 w-4" /> Detalles del Vuelo
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Airline — searchable combobox */}
                    {(() => {
                      const selectedAirline = airlines.find((a) => a.id === airlineId) ?? null;
                      const filteredAirlines = airlines.filter(
                        (a) =>
                          a.name.toLowerCase().includes(airlineSearch.toLowerCase()) ||
                          a.iata_code.toLowerCase().includes(airlineSearch.toLowerCase()),
                      );
                      return (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-neutral-700">Aerolínea</label>
                          <div className="relative">
                            {/* Trigger */}
                            <button
                              type="button"
                              onClick={() => {
                                setAirlineDropdownOpen((prev) => !prev);
                                setAirlineSearch('');
                              }}
                              className="flex w-full items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-left text-sm transition hover:border-brand-400"
                            >
                              {selectedAirline ? (
                                <>
                                  {selectedAirline.logo_url ? (
                                    <img
                                      src={selectedAirline.logo_url}
                                      alt=""
                                      className="h-5 w-5 flex-shrink-0 object-contain"
                                    />
                                  ) : (
                                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-brand-100 text-[9px] font-bold text-brand-700">
                                      {selectedAirline.iata_code}
                                    </span>
                                  )}
                                  <span className="flex-1 truncate font-medium">
                                    {selectedAirline.name}
                                    <span className="ml-1 text-xs font-normal text-neutral-400">
                                      ({selectedAirline.iata_code})
                                    </span>
                                  </span>
                                  <X
                                    className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 hover:text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAirlineId('');
                                      setAirlineDropdownOpen(false);
                                    }}
                                  />
                                </>
                              ) : customAirlineName ? (
                                <>
                                  <Plane className="h-5 w-5 flex-shrink-0 text-neutral-400" />
                                  <span className="flex-1 truncate font-medium text-neutral-700">
                                    {customAirlineName}
                                    <span className="ml-1 text-xs font-normal text-neutral-400">(personalizado)</span>
                                  </span>
                                  <X
                                    className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 hover:text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCustomAirlineName('');
                                      setAirlineDropdownOpen(false);
                                    }}
                                  />
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 text-neutral-400">— Buscar aerolínea —</span>
                                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                                </>
                              )}
                            </button>

                            {/* Dropdown panel */}
                            {airlineDropdownOpen && (
                              <>
                                {/* Backdrop */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setAirlineDropdownOpen(false)}
                                />
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
                                  {/* Search input */}
                                  <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                                    <Search className="h-4 w-4 flex-shrink-0 text-neutral-400" />
                                    <input
                                      type="text"
                                      autoFocus
                                      value={airlineSearch}
                                      onChange={(e) => setAirlineSearch(e.target.value)}
                                      placeholder="Buscar por nombre o código IATA…"
                                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                                    />
                                    {airlineSearch && (
                                      <button
                                        type="button"
                                        onClick={() => setAirlineSearch('')}
                                        className="text-neutral-400 hover:text-neutral-600"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  {/* Results list */}
                                  <div className="max-h-64 overflow-y-auto">
                                    {filteredAirlines.length === 0 ? (
                                      <div>
                                        <p className="px-4 py-2 text-xs text-neutral-400">
                                          Sin resultados para &ldquo;{airlineSearch}&rdquo;
                                        </p>
                                        {airlineSearch.trim() && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCustomAirlineName(airlineSearch.trim());
                                              setAirlineId('');
                                              setAirlineDropdownOpen(false);
                                              setAirlineSearch('');
                                            }}
                                            className="flex w-full items-center gap-3 border-t border-neutral-100 px-3 py-2.5 text-left text-sm transition hover:bg-brand-50"
                                          >
                                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-neutral-100">
                                              <Plane className="h-4 w-4 text-neutral-500" />
                                            </div>
                                            <span className="flex-1 text-sm text-neutral-700">
                                              Usar{' '}
                                              <strong className="font-semibold">&ldquo;{airlineSearch}&rdquo;</strong>{' '}
                                              como nombre de aerolínea
                                            </span>
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      filteredAirlines.map((a) => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() => {
                                            setAirlineId(a.id);
                                            setCustomAirlineName('');
                                            setAirlineDropdownOpen(false);
                                            setAirlineSearch('');
                                          }}
                                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-brand-50 ${
                                            airlineId === a.id ? 'bg-brand-50' : ''
                                          }`}
                                        >
                                          {a.logo_url ? (
                                            <img
                                              src={a.logo_url}
                                              alt=""
                                              className="h-7 w-7 flex-shrink-0 rounded object-contain"
                                            />
                                          ) : (
                                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700">
                                              {a.iata_code}
                                            </div>
                                          )}
                                          <span className="flex-1 truncate">{a.name}</span>
                                          <span className="flex-shrink-0 text-xs text-neutral-400">
                                            {a.iata_code}
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>

                                  {/* Footer counter */}
                                  <div className="border-t border-neutral-100 px-3 py-1.5 text-xs text-neutral-400">
                                    {filteredAirlines.length} aerolínea{filteredAirlines.length !== 1 ? 's' : ''}
                                    {airlineSearch ? ` coinciden con "${airlineSearch}"` : ' disponibles'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Flight number */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Número de vuelo</label>
                      <Input
                        value={flightNumber}
                        onChange={(e) => setFlightNumber(e.target.value)}
                        placeholder="TK-1780"
                      />
                    </div>

                    {/* Aircraft */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Tipo de aeronave</label>
                      <Input
                        value={aircraftType}
                        onChange={(e) => setAircraftType(e.target.value)}
                        placeholder="Boeing 777-300ER"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Origin airport */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Aeropuerto de origen</label>
                      <select
                        value={originAirportId}
                        onChange={(e) => handleOriginAirportChange(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm bg-white"
                      >
                        <option value="">— Seleccionar —</option>
                        {airports.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.city} ({a.iata_code}) — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Destination airport */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Aeropuerto de destino</label>
                      <select
                        value={destinationAirportId}
                        onChange={(e) => handleDestinationAirportChange(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm bg-white"
                      >
                        <option value="">— Seleccionar —</option>
                        {airports.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.city} ({a.iata_code}) — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Origin city (editable override) */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Ciudad de origen</label>
                      <Input
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        placeholder="La Habana"
                      />
                    </div>

                    {/* Destination city (editable override) */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Ciudad de destino</label>
                      <Input
                        value={destinationCity}
                        onChange={(e) => setDestinationCity(e.target.value)}
                        placeholder="Estambul"
                      />
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        Hora de salida
                      </label>
                      <Input
                        type="time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        Hora de llegada
                      </label>
                      <Input
                        type="time"
                        value={arrivalTime}
                        onChange={(e) => setArrivalTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Duración del vuelo</label>
                      <Input
                        value={flightDuration}
                        onChange={(e) => setFlightDuration(e.target.value)}
                        placeholder="9h 15m"
                      />
                    </div>
                  </div>

                  {/* Cabin & Baggage */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Clase de cabina</label>
                      <select
                        value={cabinClass}
                        onChange={(e) => setCabinClass(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm bg-white"
                      >
                        {CABIN_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Equipaje incluido</label>
                      <Input
                        value={baggageIncluded}
                        onChange={(e) => setBaggageIncluded(e.target.value)}
                        placeholder="1 maleta de mano (10kg) + 1 equipaje facturado (23kg)"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Escalas ── */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-700">
                    <CircleDot className="h-4 w-4" /> Escalas
                  </p>
                  {stops.length === 0 && (
                    <p className="mb-2 text-sm text-neutral-500">Vuelo directo (sin escalas)</p>
                  )}
                  {stops.map((stop, i) => (
                    <div key={i} className="mb-2 flex items-center gap-2">
                      <Input
                        value={stop.city}
                        onChange={(e) => updateStop(i, 'city', e.target.value)}
                        placeholder="Ciudad (ej: Miami)"
                        className="flex-1"
                      />
                      <Input
                        value={stop.airport_code}
                        onChange={(e) => updateStop(i, 'airport_code', e.target.value.toUpperCase())}
                        placeholder="IATA (MIA)"
                        className="w-24"
                        maxLength={4}
                      />
                      <Input
                        value={stop.duration}
                        onChange={(e) => updateStop(i, 'duration', e.target.value)}
                        placeholder="3h 20m"
                        className="w-28"
                      />
                      <button
                        type="button"
                        onClick={() => removeStop(i)}
                        className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addStop} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Agregar escala
                  </Button>
                </div>

                {/* ── Section 4: Precios ── */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-700">
                    <Tag className="h-4 w-4" /> Precios
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">
                        Precio original ($)
                        <span className="ml-1 text-xs text-neutral-400">antes del descuento</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(e.target.value)}
                        required
                        placeholder="1250.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">
                        Precio cliente ($)
                        <span className="ml-1 text-xs text-neutral-400">visible para clientes</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        required
                        placeholder="849.00"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">
                        Precio agente ($)
                        <span className="ml-1 text-xs text-neutral-400">visible para agentes</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={agentPrice}
                        onChange={(e) => setAgentPrice(e.target.value)}
                        placeholder="780.00"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {originalPrice && offerPrice && parseFloat(offerPrice) < parseFloat(originalPrice) && (
                      <p className="text-sm font-semibold text-emerald-600">
                        Cliente: {Math.round(((parseFloat(originalPrice) - parseFloat(offerPrice)) / parseFloat(originalPrice)) * 100)}% desc.
                        — ahorra ${(parseFloat(originalPrice) - parseFloat(offerPrice)).toFixed(2)}
                      </p>
                    )}
                    {originalPrice && agentPrice && parseFloat(agentPrice) < parseFloat(originalPrice) && (
                      <p className="text-sm font-semibold text-brand-600">
                        Agente: {Math.round(((parseFloat(originalPrice) - parseFloat(agentPrice)) / parseFloat(originalPrice)) * 100)}% desc.
                        — ahorra ${(parseFloat(originalPrice) - parseFloat(agentPrice)).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Section 5: Disponibilidad ── */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-700">
                    <Calendar className="h-4 w-4" /> Disponibilidad
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Max Cupos</label>
                      <Input
                        type="number"
                        min="1"
                        value={maxSeats}
                        onChange={(e) => setMaxSeats(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700">Etiqueta de Urgencia</label>
                      <Input
                        value={urgencyLabel}
                        onChange={(e) => setUrgencyLabel(e.target.value)}
                        placeholder="¡Quedan pocos cupos!"
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <label className="text-sm font-medium text-neutral-700">
                      <Calendar className="mr-1 inline h-3.5 w-3.5" />
                      Fechas válidas
                    </label>
                    <OfferDatePicker value={validDates} onChange={setValidDates} />
                  </div>
                </div>

                {/* ── Section 6: Tags ── */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">
                    Disparadores de Urgencia (Tags)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleTag(tag.value)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                          selectedTags.includes(tag.value)
                            ? tag.color + ' ring-2 ring-offset-1 ring-brand-400'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t border-neutral-200 pt-4">
                  <Button type="submit" isLoading={saving}>
                    {editingId ? 'Actualizar' : 'Crear'} Oferta
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* OFFERS GRID                            */}
          {/* ═══════════════════════════════════════ */}
          {loading ? (
            <p className="text-neutral-500">Cargando ofertas...</p>
          ) : offers.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <Tag className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
              <p className="text-neutral-500">No hay ofertas creadas</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => {
                const seatsLeft = offer.max_seats - offer.sold_seats;
                const stops = (offer.stops ?? []) as SpecialOfferStop[];
                const airlineName = offer.airline?.name ?? (offer as unknown as { custom_airline_name?: string }).custom_airline_name ?? '';
                const originCode = offer.origin_airport?.iata_code ?? '';
                const destCode = offer.destination_airport?.iata_code ?? '';

                return (
                  <Card key={offer.id} variant="bordered" className={!offer.is_active ? 'opacity-50' : ''}>
                    {/* Image */}
                    {offer.destination_img && (
                      <img
                        src={offer.destination_img}
                        alt={offer.destination}
                        className="-mx-6 -mt-6 mb-4 h-32 w-[calc(100%+3rem)] rounded-t-xl object-cover"
                      />
                    )}

                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h4 className="font-bold">{offer.destination}</h4>
                        {airlineName && (
                          <p className="text-xs text-neutral-500">
                            {airlineName} {offer.flight_number && `· ${offer.flight_number}`}
                          </p>
                        )}
                        {originCode && destCode && (
                          <p className="text-xs text-neutral-400">
                            {originCode} → {stops.length > 0 ? stops.map((s) => s.airport_code).join(' → ') + ' → ' : ''}{destCode}
                            {stops.length === 0 && ' (directo)'}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {offer.tags.map((t) => (
                            <Badge key={t} variant="warning" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant={offer.is_active ? 'success' : 'default'}>
                        {offer.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    {/* Price */}
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-sm text-neutral-400 line-through">${offer.original_price}</span>
                      <span className="text-xl font-bold text-emerald-600">${offer.offer_price}</span>
                    </div>

                    {/* Details */}
                    <div className="space-y-0.5 text-xs text-neutral-500">
                      {offer.departure_time && (
                        <p>
                          🕐 {offer.departure_time?.toString().slice(0, 5)} → {offer.arrival_time?.toString().slice(0, 5)}
                          {offer.flight_duration && ` (${offer.flight_duration})`}
                        </p>
                      )}
                      <p>
                        📅 {offer.valid_dates.length} fechas · 💺 {seatsLeft} cupos restantes
                      </p>
                      {offer.aircraft_type && <p>✈️ {offer.aircraft_type}</p>}
                    </div>

                    {offer.urgency_label && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <Flame className="h-3 w-3" /> {offer.urgency_label}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
                      <button
                        onClick={() => editOffer(offer)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                      >
                        <Edit className="h-3 w-3" /> Editar
                      </button>
                      <button
                        onClick={() => toggleActive(offer.id, offer.is_active)}
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:underline"
                      >
                        {offer.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {offer.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => deleteOffer(offer.id)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
