/**
 * @fileoverview Car rentals listing page.
 * @module app/(public)/cars/page
 */
import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import CarRentalCard from '@/components/features/cars/CarRentalCard';
import type { CarRental } from '@/types/models';

export const metadata: Metadata = { title: 'Renta de Autos' };

/* Static seed data — replaced by Supabase query in production */
const CARS: CarRental[] = [
  { id: '1', brand: 'Hyundai', model: 'Accent', category: 'economy', transmission: 'automatic', passenger_capacity: 5, luggage_capacity: 2, daily_rate: 45, available_units: 3, image_url: null, features: ['A/C', 'Bluetooth', 'USB'], is_active: true },
  { id: '2', brand: 'Toyota', model: 'RAV4', category: 'suv', transmission: 'automatic', passenger_capacity: 5, luggage_capacity: 4, daily_rate: 75, available_units: 2, image_url: null, features: ['A/C', 'GPS', '4x4', 'Bluetooth'], is_active: true },
  { id: '3', brand: 'Kia', model: 'Picanto', category: 'compact', transmission: 'manual', passenger_capacity: 4, luggage_capacity: 1, daily_rate: 35, available_units: 5, image_url: null, features: ['A/C', 'Radio FM'], is_active: true },
];

export default function CarsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[72px]">
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-brand-500">
                Renta de Autos
              </span>
              <h1 className="mt-2 font-display text-4xl font-bold text-brand-950">
                Explora Cuba a tu ritmo
              </h1>
              <p className="mx-auto mt-2 max-w-lg text-neutral-600">
                Vehículos confiables con seguro incluido y asistencia en carretera 24/7
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CARS.map((car) => (
                <CarRentalCard key={car.id} car={car} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
