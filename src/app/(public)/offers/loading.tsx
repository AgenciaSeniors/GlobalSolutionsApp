import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function Loading() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 space-y-3">
              <div className="h-6 w-52 rounded bg-neutral-200 animate-pulse" />
              <div className="h-10 w-80 rounded bg-neutral-200 animate-pulse" />
              <div className="h-4 w-[520px] max-w-full rounded bg-neutral-200 animate-pulse" />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3 rounded-2xl border bg-white p-6">
                <div className="h-6 w-40 rounded bg-neutral-200 animate-pulse" />
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border bg-white p-5">
                    <div className="h-4 w-44 rounded bg-neutral-200 animate-pulse" />
                    <div className="mt-3 h-8 w-28 rounded bg-neutral-200 animate-pulse" />
                    <div className="mt-4 h-10 w-full rounded bg-neutral-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
