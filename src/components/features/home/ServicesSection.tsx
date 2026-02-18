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
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">
            Servicios
          </span>
          <h2 className="mt-2 font-display text-4xl font-bold text-brand-950">
            Todo lo que necesitas para tu viaje
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="group rounded-3xl border border-neutral-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <s.icon className="h-6 w-6" />
              </div>

              <h3 className="mt-5 text-xl font-bold text-brand-950">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.desc}</p>

              <div className="mt-6">
                <Link href={s.href}>
                  <Button variant="outline" className="gap-2">
                    Ver más <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
