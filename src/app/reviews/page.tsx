// app/reviews/page.tsx
import type { Metadata } from 'next';
import ReviewsFeed from "./reviews-feed";

export const metadata: Metadata = {
  title: 'Reseñas de Clientes — +5,000 Viajeros Satisfechos',
  description: 'Lee opiniones reales de viajeros que reservaron vuelos y autos con Global Solutions Travel. Más de 5,000 clientes satisfechos.',
  alternates: { canonical: '/reviews' },
};

export default function ReviewsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-8 rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Reseñas</h1>
        <p className="mt-2 text-sm opacity-80">
          Opiniones reales de clientes que ya compraron en la plataforma.
        </p>
      </section>

      <ReviewsFeed />
    </main>
  );
}