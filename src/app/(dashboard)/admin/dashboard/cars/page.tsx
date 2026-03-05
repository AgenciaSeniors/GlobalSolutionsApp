/**
 * @fileoverview Admin Cars management page — list all cars with actions.
 * @module app/(dashboard)/admin/dashboard/cars/page
 * @author Dev B
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/formatters';
import PageLoader from '@/components/ui/PageLoader';
import { Plus, Pencil, Eye, EyeOff, Car, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Car as CarType } from '@/lib/cars/types';
import { CATEGORY_LABELS } from '@/lib/cars/types';

export default function AdminCarsPage() {
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCars = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('car_rentals')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCars(
        data.map((row: Record<string, unknown>) => ({
          ...row,
          daily_rate: Number(row.daily_rate ?? 0),
          features: Array.isArray(row.features) ? row.features : [],
          image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
          specs: typeof row.specs === 'object' && row.specs ? row.specs : {},
        })) as CarType[],
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchCars();
  }, [fetchCars]);

  async function handleToggle(id: string, currentActive: boolean) {
    setToggling(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('car_rentals')
      .update({ is_active: !currentActive })
      .eq('id', id);

    if (!error) {
      setCars((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !currentActive } : c)),
      );
    }
    setToggling(null);
  }

  async function handleDelete(id: string, brand: string, model: string) {
    if (!confirm(`¿Eliminar permanentemente el auto "${brand} ${model}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeleting(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('car_rentals')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(`No se pudo eliminar: ${error.message}`);
    } else {
      toast.success('Auto eliminado correctamente');
      setCars((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleting(null);
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1 min-w-0">
        <Header title="Gestión de Autos" />
        <div className="p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Inventario de Autos</h2>
              <p className="text-sm text-neutral-500">
                {cars.length} auto{cars.length !== 1 && 's'} en total ·{' '}
                {cars.filter((c) => c.is_active).length} activo{cars.filter((c) => c.is_active).length !== 1 && 's'}
              </p>
            </div>
            <Link href="/admin/dashboard/cars/new">
              <Button size="sm">
                <Plus className="h-4 w-4" /> Nuevo Auto
              </Button>
            </Link>
          </div>

          {loading ? (
            <PageLoader message="Cargando inventario..." />
          ) : cars.length === 0 ? (
            <Card className="p-12 text-center">
              <Car className="mx-auto h-12 w-12 text-neutral-300" />
              <p className="mt-3 text-neutral-500">No hay autos registrados.</p>
              <Link href="/admin/dashboard/cars/new" className="mt-4 inline-block">
                <Button size="sm">Crear primer auto</Button>
              </Link>
            </Card>
          ) : (
            <>
              {/* ── Mobile: tarjetas (pantallas < md) ── */}
              <div className="md:hidden space-y-3">
                {cars.map((car) => (
                  <div key={car.id} className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {car.image_url ? (
                          <img
                            src={car.image_url}
                            alt={`${car.brand} ${car.model}`}
                            className="h-12 w-16 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                            <Car className="h-5 w-5 text-brand-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-neutral-900 truncate">{car.brand} {car.model}</p>
                          <p className="text-xs text-neutral-400">{car.specs?.year ?? ''} · {car.transmission === 'automatic' ? 'Auto' : 'Manual'}</p>
                        </div>
                        <Badge variant={car.is_active ? 'success' : 'warning'} className="shrink-0 text-xs">
                          {car.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-[11px] text-neutral-400 mb-0.5">Categoría</p>
                          <Badge variant="info" className="text-xs">
                            {CATEGORY_LABELS[car.category as keyof typeof CATEGORY_LABELS] ?? car.category}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-[11px] text-neutral-400 mb-0.5">Precio/día</p>
                          <p className="font-semibold text-brand-600">{formatCurrency(car.daily_rate)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-neutral-400 mb-0.5">Unidades</p>
                          <p className="text-neutral-700">{car.available_units}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-neutral-400 mb-0.5">Ubicación</p>
                          <p className="text-neutral-500 text-xs truncate">{car.pickup_location}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1 px-4 py-2 border-t border-neutral-100 bg-neutral-50/50">
                      <Link href={`/admin/dashboard/cars/${car.id}/edit`}>
                        <button className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleToggle(car.id, car.is_active)}
                        disabled={toggling === car.id}
                        className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors disabled:opacity-50"
                        title={car.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {toggling === car.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : car.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(car.id, car.brand, car.model)}
                        disabled={deleting === car.id}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        {deleting === car.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop: tabla (md+) ── */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-100 bg-neutral-50 text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Auto</th>
                      <th className="px-4 py-3">Categoría</th>
                      <th className="px-4 py-3">Precio/día</th>
                      <th className="px-4 py-3">Unidades</th>
                      <th className="px-4 py-3">Ubicación</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {cars.map((car) => (
                      <tr key={car.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {car.image_url ? (
                              <img
                                src={car.image_url}
                                alt={`${car.brand} ${car.model}`}
                                className="h-10 w-14 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-brand-50">
                                <Car className="h-5 w-5 text-brand-300" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-neutral-900">
                                {car.brand} {car.model}
                              </p>
                              <p className="text-xs text-neutral-400">
                                {car.specs?.year ?? ''} · {car.transmission === 'automatic' ? 'Auto' : 'Manual'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="info">
                            {CATEGORY_LABELS[car.category as keyof typeof CATEGORY_LABELS] ?? car.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-brand-600">
                          {formatCurrency(car.daily_rate)}
                        </td>
                        <td className="px-4 py-3">{car.available_units}</td>
                        <td className="px-4 py-3 text-neutral-500">{car.pickup_location}</td>
                        <td className="px-4 py-3">
                          <Badge variant={car.is_active ? 'success' : 'warning'}>
                            {car.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/dashboard/cars/${car.id}/edit`}>
                              <button className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleToggle(car.id, car.is_active)}
                              disabled={toggling === car.id}
                              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors disabled:opacity-50"
                              title={car.is_active ? 'Desactivar' : 'Activar'}
                            >
                              {car.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(car.id, car.brand, car.model)}
                              disabled={deleting === car.id}
                              className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
