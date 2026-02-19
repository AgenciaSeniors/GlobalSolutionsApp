/**
 * @fileoverview Admin Offers Management — Visual offer engine.
 * Per spec §3.2 Backend: Admin selects dates on calendar,
 * uploads high-quality image, activates urgency triggers.
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
import { createClient } from '@/lib/supabase/client';
import { Plus, Tag, Flame, Edit, Trash2, Eye, EyeOff, Calendar } from 'lucide-react';
import type { SpecialOffer } from '@/types/models';

const TAG_OPTIONS = [
  { value: 'exclusive', label: 'Exclusivo', color: 'bg-brand-100 text-brand-700' },
  { value: 'flash_24h', label: 'Flash 24h', color: 'bg-red-100 text-red-700' },
  { value: 'fire', label: '🔥 Fuego', color: 'bg-orange-100 text-orange-700' },
  { value: 'few_seats', label: 'Pocos cupos', color: 'bg-amber-100 text-amber-700' },
];

export default function AdminOffersPage() {
  const supabase = createClient();
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [destination, setDestination] = useState('');
  const [destinationImg, setDestinationImg] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [originalPrice, setOriginalPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [validDates, setValidDates] = useState('');
  const [urgencyLabel, setUrgencyLabel] = useState('');
  const [maxSeats, setMaxSeats] = useState('20');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  


  useEffect(() => { fetchOffers(); }, []);

  useEffect(() => {
  if (!imageFile) {
    setImagePreviewUrl(null);
    return;
  }

  const url = URL.createObjectURL(imageFile);
  setImagePreviewUrl(url);

  return () => URL.revokeObjectURL(url);
}, [imageFile]);


  async function fetchOffers() {
  setLoading(true);
  setErrorMsg(null);

  const { data, error } = await supabase
    .from('special_offers')
    .select('*')
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
    setDestination(''); setDestinationImg(''); setOriginalPrice('');
    setOfferPrice(''); setValidDates(''); setUrgencyLabel('');
    setMaxSeats('20'); setSelectedTags([]); setEditingId(null);
    setImageFile(null);
    setImagePreviewUrl(null);

  }

  function editOffer(offer: SpecialOffer) {
    setEditingId(offer.id);
    setDestination(offer.destination);
    setDestinationImg(offer.destination_img || '');
    setOriginalPrice(offer.original_price.toString());
    setOfferPrice(offer.offer_price.toString());
    setValidDates(offer.valid_dates.join(', '));
    setUrgencyLabel(offer.urgency_label || '');
    setMaxSeats(offer.max_seats.toString());
    setSelectedTags(offer.tags);
    setImageFile(null);
    setImagePreviewUrl(null);
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

  const { error: uploadError } = await supabase
    .storage
    .from('offer-images')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('offer-images').getPublicUrl(path);
  return data.publicUrl;
}

  async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  setSaving(true);

  try {
    const dates = validDates.split(',').map(d => d.trim()).filter(Boolean);

    let finalImgUrl = destinationImg;
    if (imageFile) {
      finalImgUrl = await uploadOfferImage(imageFile);
      setDestinationImg(finalImgUrl); // para que el preview quede con la nueva
    }

    const payload = {
      destination,
      destination_img: finalImgUrl || null,
      original_price: parseFloat(originalPrice),
      offer_price: parseFloat(offerPrice),
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
  } catch (err: any) {
    console.error(err);
    alert(err?.message || 'Error guardando la oferta');
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
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header
          title="Ofertas Visuales"
          subtitle="Motor de ofertas exclusivas — Calendario, imágenes, urgencia"
        />
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Tag className="h-4 w-4" />
              {offers.length} ofertas totales · {offers.filter(o => o.is_active).length} activas
            </div>
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva Oferta
            </Button>
            {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
           {errorMsg}
           </div>
          )}

          </div>

          {/* Form */}
          {showForm && (
            <Card variant="bordered" className="mb-8 border-brand-200 bg-brand-50/30">
              <h3 className="font-bold text-lg mb-4">
                {editingId ? 'Editar Oferta' : 'Nueva Oferta Exclusiva'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="destino" className="mb-1 block text-sm font-medium text-neutral-700">
                      Destino
                    </label>
                    <Input
value={destination} onChange={e => setDestination(e.target.value)} placeholder="Estambul, Turquía" required
                    id="destino"
                    />
                  </div>
                  <div className="space-y-1">
                   <label htmlFor="imagen_destino" className="mb-1 block text-sm font-medium text-neutral-700">
  Imagen destino (Supabase Storage)
</label>

<input
  id="imagen_destino"
  type="file"
  accept="image/*"
  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
/>

{(imagePreviewUrl || destinationImg) && (
  <img
    src={imagePreviewUrl || destinationImg}
    alt="preview"
    className="mt-3 h-24 w-full rounded-xl object-cover"
  />
)}

                  </div>
                  <div className="space-y-1">
                    <label htmlFor="precio_original" className="mb-1 block text-sm font-medium text-neutral-700">
                      Precio Original ($)
                    </label>
                    <Input
type="number" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} required
                    id="precio_original"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="precio_oferta" className="mb-1 block text-sm font-medium text-neutral-700">
                      Precio Oferta ($)
                    </label>
                    <Input
type="number" step="0.01" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} required
                    id="precio_oferta"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="max_cupos" className="mb-1 block text-sm font-medium text-neutral-700">
                      Max Cupos
                    </label>
                    <Input
type="number" value={maxSeats} onChange={e => setMaxSeats(e.target.value)}
                    id="max_cupos"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="etiqueta_de_urgencia" className="mb-1 block text-sm font-medium text-neutral-700">
                      Etiqueta de Urgencia
                    </label>
                    <Input
value={urgencyLabel} onChange={e => setUrgencyLabel(e.target.value)} placeholder="¡Quedan pocos cupos!"
                    id="etiqueta_de_urgencia"
                    />
                  </div>
                </div>

                {/* Date selector */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Fechas válidas (separadas por coma, formato YYYY-MM-DD)
                  </label>
                  <textarea
                    value={validDates}
                    onChange={e => setValidDates(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm resize-none"
                    rows={2}
                    placeholder="2026-03-03, 2026-03-10, 2026-03-17"
                    required
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Disparadores de Urgencia (Tags)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {TAG_OPTIONS.map(tag => (
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

                <div className="flex gap-3">
                  <Button type="submit" isLoading={saving}>
                    {editingId ? 'Actualizar' : 'Crear'} Oferta
                  </Button>
                  <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Offers Grid */}
          {loading ? (
            <p className="text-neutral-500">Cargando ofertas...</p>
          ) : offers.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <Tag className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
              <p className="text-neutral-500">No hay ofertas creadas</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map(offer => {
                const seatsLeft = offer.max_seats - offer.sold_seats;
                return (
                  <Card key={offer.id} variant="bordered" className={!offer.is_active ? 'opacity-50' : ''}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold">{offer.destination}</h4>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {offer.tags.map(t => (
                            <Badge key={t} variant="warning" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge variant={offer.is_active ? 'success' : 'default'}>
                        {offer.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-sm text-neutral-400 line-through">${offer.original_price}</span>
                      <span className="text-xl font-bold text-emerald-600">${offer.offer_price}</span>
                    </div>

                    <p className="text-xs text-neutral-500 mb-1">
                      {offer.valid_dates.length} fechas · {seatsLeft} cupos restantes
                    </p>

                    {offer.urgency_label && (
                      <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-3">
                        <Flame className="h-3 w-3" /> {offer.urgency_label}
                      </p>
                    )}

                    <div className="flex gap-2 mt-3 border-t border-neutral-100 pt-3">
                      <button onClick={() => editOffer(offer)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                        <Edit className="h-3 w-3" /> Editar
                      </button>
                      <button onClick={() => toggleActive(offer.id, offer.is_active)} className="text-xs text-neutral-500 hover:underline flex items-center gap-1">
                        {offer.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {offer.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => deleteOffer(offer.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
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
