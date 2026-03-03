'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { t } = useLanguage();

  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;

    setPaying(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? t('payment.error.failed'));
      setPaying(false);
      return;
    }

    setSuccess(true);
    setPaying(false);
    router.push('/user/dashboard/bookings');
  }

  if (success) {
    return (
      <Card variant="bordered" className="p-6">
        <p className="font-bold text-emerald-600">{t('payment.success.title')}</p>
        <p className="mt-2 text-neutral-700">
          {t('payment.success.message')}
        </p>
        <div className="mt-4">
          <a className="underline" href="/user/dashboard/bookings">
            {t('payment.success.goToBookings')}
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="p-6">
      <h2 className="font-bold text-neutral-900">{t('payment.method')}</h2>

      <div className="mt-4">
        <PaymentElement />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <Button onClick={onPay} disabled={!stripe || !elements || paying}>
          {paying ? t('payment.paying') : t('payment.pay')}
        </Button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {t('payment.noReload')}
      </p>
    </Card>
  );
}
