// src/components/forms/LoginForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth.schema';
import { ROUTES } from '@/lib/constants/routes';
import { authService } from '@/services/auth.service';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const confirmed = searchParams.get('confirmed') === 'true';
  const { t } = useLanguage();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [form, setForm] = useState<LoginFormValues>({ email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setIsLoading(true);

    try {
      if (step === 'credentials') {
        const validation = loginSchema.safeParse(form);
        if (!validation.success) {
          setServerError(t('auth.login.error.invalid'));
          return;
        }

        const result = await authService.signInStepOne(form.email, form.password);

        if (
          result.message === 'ALREADY_AUTHENTICATED' ||
          result.message === 'SIGNED_IN_TRUSTED_DEVICE'
        ) {
          window.location.href = '/';
          return;
        }

        setStep('otp');
        return;
      }

      // ─── Step 2: Verify OTP ───
      if (otpCode.trim().length !== 6) {
        setServerError(t('auth.login.error.otpLength'));
        return;
      }

      const result = await authService.verifyLoginOtp(form.email, otpCode.trim());

      if ('sessionLink' in result && result.sessionLink) {
        window.location.href = result.sessionLink;
      } else {
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.login.error.auth');
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {confirmed && !serverError && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
          {t('auth.login.emailConfirmed')}
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 border border-red-100">
          {serverError}
        </div>
      )}

      {step === 'credentials' ? (
        <>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">{t('auth.login.email')}</label>
            <Input
              type="email"
              placeholder={t('auth.login.emailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">{t('auth.login.password')}</label>
            <Input
              type="password"
              showPasswordToggle
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded border-neutral-300" />
              <span className="text-sm text-neutral-600">{t('auth.login.keepSession')}</span>
            </label>
            <Link href={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-brand-600">
              {t('auth.login.forgotPassword')}
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setOtpCode('');
              setServerError(null);
            }}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('auth.login.back')}
          </button>

          <div className="text-center bg-brand-50 rounded-xl p-4 border border-brand-100">
            <Lock className="h-5 w-5 text-brand-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">
              {t('auth.login.codeSentTo')} <b>{form.email}</b>
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">{t('auth.login.verificationCode')}</label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setOtpCode(value);
              }}
              required
              className="text-center text-2xl tracking-[0.4em] font-mono"
            />
          </div>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {step === 'credentials' ? t('auth.login.continue') : t('auth.login.verifyAndEnter')}
      </Button>

      <p className="text-center text-sm text-neutral-600">
        {t('auth.login.noAccount')}{' '}
        <Link href={ROUTES.REGISTER} className="font-semibold text-brand-600 underline">
          {t('auth.login.signUp')}
        </Link>
      </p>

      <div className="flex items-center justify-center gap-1.5 pt-2 opacity-50">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Secure Auth</span>
      </div>
    </form>
  );
}
