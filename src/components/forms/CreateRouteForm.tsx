'use client';

import { useState, type FormEvent } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type FormState = {
  outbound_route: string;
  return_route: string;
};

function normalizeRoute(value: string): string {
  // Mantiene espacios y slash como pidió el usuario, solo compacta espacios repetidos.
  return value.replace(/\s+/g, ' ').trim();
}

export default function CreateRouteForm() {
  const [form, setForm] = useState<FormState>({
    outbound_route: '',
    return_route: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const outbound = normalizeRoute(form.outbound_route);
    const inbound = normalizeRoute(form.return_route);

    if (!outbound || !inbound) {
      setError('Completa Ruta de salida y Ruta de llegada.');
      return;
    }

    // Por ahora solo UI. Luego conectamos este botón con el soporte (ticket/whatsapp/email/etc).
    setNotice('Listo. Esto se enviará a soporte cuando conectemos el botón.');
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-neutral-100 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Crear Ruta</h2>
       

        <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <Input
            label="Lugar de salida"
            value={form.outbound_route}
            onChange={(e) => setForm((p) => ({ ...p, outbound_route: e.target.value }))}
            placeholder="Ej: La Habana"
          />

          <Input
            label="Lugar de llegada"
            value={form.return_route}
            onChange={(e) => setForm((p) => ({ ...p, return_route: e.target.value }))}
            placeholder="Ej: Panamá"
          />

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <Button type="submit">
              Consultar al soporte
            </Button>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-600">{notice}</p>}
          </div>
        </form>
      </Card>
    </div>
  );
}
