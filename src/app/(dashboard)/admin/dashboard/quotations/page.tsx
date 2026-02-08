/**
 * @fileoverview Admin Quotation Requests management.
 * Per spec §3.3: When no flight results, clients request a quote.
 * Admin assigns, responds with price.
 */
'use client';

import { useEffect, useState } from 'react';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, DollarSign, Clock } from 'lucide-react';
import type { QuotationRequest } from '@/types/models';

export default function AdminQuotationsPage() {
  const supabase = createClient();
  const [quotations, setQuotations] = useState<QuotationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState<string | null>(null);
  const [quotedPrice, setQuotedPrice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => { fetchQuotations(); }, []);

  async function fetchQuotations() {
    setLoading(true);
    const { data } = await supabase
      .from('quotation_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setQuotations((data as QuotationRequest[]) || []);
    setLoading(false);
  }

  async function handleQuote(id: string) {
    await supabase
      .from('quotation_requests')
      .update({
        status: 'quoted',
        quoted_price: parseFloat(quotedPrice),
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setReplying(null);
    setQuotedPrice('');
    setAdminNotes('');
    fetchQuotations();
  }

  const statusColor: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
    pending: 'warning',
    assigned: 'info',
    quoted: 'success',
    accepted: 'success',
    expired: 'error',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Solicitudes de Cotización" subtitle="Clientes que necesitan presupuesto personalizado" />
        <div className="p-8">
          {loading ? (
            <p className="text-neutral-500">Cargando...</p>
          ) : quotations.length === 0 ? (
            <Card variant="bordered" className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 h-12 w-12 text-neutral-300" />
              <p className="font-semibold">No hay solicitudes pendientes</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {quotations.map(q => (
                <Card key={q.id} variant="bordered">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <Badge variant={statusColor[q.status] || 'warning'}>{q.status}</Badge>
                        <span className="text-xs text-neutral-400">
                          <Clock className="mr-1 inline h-3 w-3" />
                          {new Date(q.created_at).toLocaleDateString('es')}
                        </span>
                      </div>
                      <p className="font-semibold">{q.origin} → {q.destination}</p>
                      <p className="text-sm text-neutral-600">
                        {q.guest_name || 'Cliente registrado'} · {q.guest_email} · {q.passengers} pasajero(s)
                      </p>
                      <p className="text-sm text-neutral-500">
                        Salida: {q.departure_date} {q.return_date ? `· Regreso: ${q.return_date}` : '(Solo ida)'}
                      </p>
                      {q.notes && <p className="mt-1 text-sm italic text-neutral-400">"{q.notes}"</p>}
                      {q.quoted_price && (
                        <p className="mt-2 flex items-center gap-1 text-lg font-bold text-emerald-600">
                          <DollarSign className="h-4 w-4" /> {q.quoted_price.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div>
                      {q.status === 'pending' && (
                        replying === q.id ? (
                          <div className="space-y-3">
                            <Input label="Precio Cotizado ($)" type="number" value={quotedPrice} onChange={e => setQuotedPrice(e.target.value)} />
                            <Input label="Notas" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleQuote(q.id)}>Enviar Cotización</Button>
                              <Button size="sm" variant="outline" onClick={() => setReplying(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" onClick={() => setReplying(q.id)}>Cotizar</Button>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
