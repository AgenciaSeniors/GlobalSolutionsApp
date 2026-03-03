'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/features/home/HeroSection';
import FlightSearchForm from '@/components/forms/FlightSearchForm';
import ReviewCard from '@/components/features/reviews/ReviewCard';
import AboutSection from '@/components/features/home/AboutSection';
import ServicesSection from '@/components/features/home/ServicesSection';
import HomeOffersCarousel from '@/components/features/home/HomeOffersCarousel';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { SpecialOffer } from '@/types/models';

interface ReviewView {
  authorName: string;
  authorInitials: string;
  destination: string;
  dateEs: string;
  dateEn: string;
  rating: number;
  comment: string;
}

export default function HomePageContent({ offers, reviews }: { offers: SpecialOffer[]; reviews: ReviewView[] }) {
  const { t, language } = useLanguage();

  return (
    <>
      <Navbar />
      <HeroSection />
      <section className="bg-neutral-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700">{t('home.offers.badge')}</span>
            <h2 className="mt-3 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">{t('home.offers.title')}</h2>
            <p className="mt-2 text-sm text-neutral-600 sm:text-base">{t('home.offers.subtitle')}</p>
          </div>
          {offers.length === 0 ? <div className="rounded-2xl border bg-white p-8 text-center shadow-sm"><p className="text-sm text-neutral-700">{t('home.offers.empty')}</p></div> : <HomeOffersCarousel offers={offers} />}
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-brand-500">{t('home.flightSearch.badge')}</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">{t('home.flightSearch.title')}</h2>
          </div>
          <FlightSearchForm />
        </div>
      </section>

      <AboutSection />
      <ServicesSection />

      <section className="bg-gradient-to-b from-neutral-50 to-brand-50 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 text-center sm:mb-12">
            <span className="text-sm font-bold uppercase tracking-widest text-emerald-600">{t('home.reviews.badge')}</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand-950 sm:text-3xl md:text-4xl">{t('home.reviews.title')}</h2>
            <div className="mt-6 flex justify-center"><Link href="/reviews" className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-sm hover:bg-neutral-50">{t('home.reviews.cta')}</Link></div>
          </div>
          {reviews.length === 0 ? <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm"><p className="text-sm text-neutral-700">{t('home.reviews.empty')}</p></div> : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">{reviews.slice(0,3).map((r,i)=><ReviewCard key={`${r.authorName}-${i}`} authorName={r.authorName || t('home.travelerFallback')} authorInitials={r.authorInitials} destination={r.destination || t('home.destinationFallback')} date={language==='en'?r.dateEn:r.dateEs} rating={r.rating} comment={r.comment} />)}</div>}
        </div>
      </section>
      <Footer />
    </>
  );
}
