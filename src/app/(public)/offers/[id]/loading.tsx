import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function Loading() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-neutral-50 pt-[72px]">
        <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-indigo-900 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <div className="h-5 w-40 rounded bg-white/15 animate-pulse" />
            <div className="mt-4 h-10 w-72 rounded bg-white/15 animate-pulse" />
            <div className="mt-3 h-6 w-52 rounded bg-white/15 animate-pulse" />
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3 rounded-2xl border bg-white p-6">
              <div className="h-6 w-48 rounded bg-neutral-200 animate-pulse" />
              <div className="mt-4 grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-white p-6">
                  <div className="h-5 w-40 rounded bg-neutral-200 animate-pulse" />
                  <div className="mt-4 h-4 w-full rounded bg-neutral-100 animate-pulse" />
                  <div className="mt-2 h-4 w-4/5 rounded bg-neutral-100 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
