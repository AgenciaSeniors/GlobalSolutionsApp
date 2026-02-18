import Link from 'next/link';
import { Plane, Car, Tag, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';

const SERVICES = [
  {
    icon: Plane,
    title: 'Vuelos',
    desc: 'Búsqueda rápida, resultados claros y selección sin estrés.',
    href: ROUTES.FLIGHTS,
  },
  {
    icon: Car,
    title: 'Renta de Autos',
    desc: 'Reservas simples y soporte si algo cambia en tu viaje.',
    href: ROUTES.CARS,
  },
  {
    icon: Tag,
    title: 'Ofertas',
    desc: 'Promos con urgencia real: fechas limitadas y cupos contados.',
    href: ROUTES.OFFERS,
  },
];

export default function ServicesSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-brand-700">
            Servicios
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF4757]" />
          </span>

          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-brand-950">
            Todo lo que necesitas para tu viaje{' '}
            <span className="text-[#FF4757]">en un solo lugar</span>
          </h2>

          <p className="mt-3 text-neutral-600">
            Experiencia clara, diseño moderno y soporte real.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="group relative overflow-hidden rounded-3xl border border-neutral-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
            >
              {/* Barra superior navy→coral */}
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-950 to-[#FF4757]" />

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-100">
                <s.icon className="h-6 w-6" />
              </div>

              <h3 className="mt-5 text-xl font-extrabold text-brand-950">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.desc}</p>

              <div className="mt-6">
                <Link href={s.href}>
                 <Button className="gap-2 bg-[#FF4757] text-white hover:bg-[#ff2f43]">
  Ver más 
</Button>

                </Link>
              </div>

              {/* glow sutil coral */}
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-[#FF4757]/10 blur-3xl opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
