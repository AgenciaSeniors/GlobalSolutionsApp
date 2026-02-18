/**
 * @fileoverview Admin — Edit car page. Loads car data then renders form.
 * @author Dev B
 */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar, { ADMIN_SIDEBAR_LINKS } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CarForm from '@/components/features/cars/CarForm';
import { createClient } from '@/lib/supabase/client';
import type { Car } from '@/lib/cars/types';
import { Loader2 } from 'lucide-react';

export default function EditCarPage() {
  const params = useParams();
  const carId = params.id as string;
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('car_rentals')
        .select('*')
        .eq('id', carId)
        .maybeSingle();

      if (!error && data) {
        setCar({
          ...data,
          daily_rate: Number(data.daily_rate ?? 0),
          features: Array.isArray(data.features) ? data.features : [],
          image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
          specs: typeof data.specs === 'object' && data.specs ? data.specs : {},
        } as Car);
      }
      setLoading(false);
    }
    void load();
  }, [carId]);

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar links={ADMIN_SIDEBAR_LINKS} />
      <div className="flex-1">
        <Header title="Editar Auto" />
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          ) : car ? (
            <CarForm car={car} mode="edit" />
          ) : (
            <p className="text-center text-neutral-500">Auto no encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
