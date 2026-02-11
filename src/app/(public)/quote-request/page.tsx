/**
 * @fileoverview Quote Request page — "Solicitar Cotización a un Agente".
 * Per spec §3.3: When no results or complex route, user submits form.
 * Generates a ticket for administration.
 */
'use client';

import { useState, type FormEvent } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { Send, CheckCircle, Plane } from 'lucide-react';

export default function QuoteRequestPage() {
  const supabase = createClient();
  const { user, profile } = useAuthContext();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    origin: '',
    destination: '',
    departure_date: '',
    return_date: '',
    passengers: '1',
    trip_type: 'roundtrip',
    notes: '',
  });

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    await supabase.from('quotation_requests').insert({
      user_id: user?.id || null,
      guest_name: form.name || null,
      guest_email: form.email,
      guest_phone: form.phone || null,
      origin: form.origin,
      destination: form.destination,
      departure_date: form.departure_date,
      return_date: form.return_date || null,
      passengers: parseInt(form.passengers),
      trip_type: form.trip_type,
      notes: form.notes || null,
    });

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-20">
        <div className="mx-auto max-w-2xl px-6">
          {submitted ? (
            <Card className="py-16 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
              <h1 className="text-2xl font-bold text-neutral-900">¡Solicitud Enviada!</h1>
              <p className="mt-2 text-neutral-600">
                Nuestro equipo te contactará en un plazo máximo de 24 horas
                con una cotización personalizada a <strong>{form.email}</strong>.
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-8 text-center">
                <Plane className="mx-auto mb-3 h-12 w-12 text-brand-600" />
                <h1 className="font-display text-3xl font-bold text-brand-950">
                  Solicitar Cotización
                </h1>
                <p className="mt-2 text-neutral-600">
                  ¿No encontraste tu vuelo? Nuestros agentes te consiguen el mejor precio.
                </p>
              </div>

              <Card variant="bordered">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Nombre</label>
                      <Input value={form.name} onChange={update('name')} placeholder="Tu nombre completo" required />
                    </div>

                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
                      <Input type="email" value={form.email} onChange={update('email')} placeholder="correo@ejemplo.com" required />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="mb-1 block text-sm font-medium text-neutral-700">Teléfono (opcional)</label>
                    <Input type="tel" value={form.phone} onChange={update('phone')} placeholder="+53 5555 5555" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Origen</label>
                      <Input value={form.origin} onChange={update('origin')} placeholder="Ej: La Habana (HAV)" required />
                    </div>

                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Destino</label>
                      <Input value={form.destination} onChange={update('destination')} placeholder="Ej: Estambul (IST)" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Fecha de Salida</label>
                      <Input type="date" value={form.departure_date} onChange={update('departure_date')} required />
                    </div>

                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Fecha de Regreso</label>
                      <Input type="date" value={form.return_date} onChange={update('return_date')} />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-neutral-700">Pasajeros</label>
                      <select value={form.passengers} onChange={update('passengers')} className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm">
                        {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">Tipo de Viaje</label>
                    <div className="flex gap-4">
                      {['roundtrip', 'oneway'].map(t => (
                        <label key={t} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="trip_type" value={t} checked={form.trip_type === t} onChange={update('trip_type')} />
                          {t === 'roundtrip' ? 'Ida y Vuelta' : 'Solo Ida'}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-neutral-700">Notas adicionales</label>
                    <textarea
                      value={form.notes} onChange={update('notes')}
                      className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
                      rows={3} placeholder="Preferencias de horario, aerolínea, escalas..."
                    />
                  </div>

                  <Button type="submit" isLoading={loading} className="w-full gap-2">
                    <Send className="h-4 w-4" /> Enviar Solicitud de Cotización
                  </Button>
                </form>
              </Card>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
