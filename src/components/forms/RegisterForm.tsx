"use client";

import * as React from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { authService } from "@/services/auth.service";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function RegisterForm() {
  const { t } = useLanguage();
  const [step, setStep] = React.useState<"form" | "otp">("form");
  const [isLoading, setIsLoading] = React.useState(false);

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);
  const [duplicateEmail, setDuplicateEmail] = React.useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setDuplicateEmail(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!fullName.trim()) return setErrorMsg(t('auth.register.error.fullName'));
    if (!normalizedEmail) return setErrorMsg(t('auth.register.error.email'));
    if (!password) return setErrorMsg(t('auth.register.error.password'));

    setIsLoading(true);
    try {
      await authService.signUpStepOne(normalizedEmail);
      setStep("otp");
      setInfoMsg(t('auth.register.codeHint'));
    } catch (err: any) {
      if (err?.status === 409) {
        setDuplicateEmail(true);
      } else {
        setErrorMsg(err?.message ?? t('auth.register.error.sendCode'));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyAndCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!code.trim()) return setErrorMsg(t('auth.register.error.code'));

    setIsLoading(true);
    try {
      await authService.verifySignupOtp(normalizedEmail, code.trim(), fullName.trim(), password);
      window.location.href = "/user/dashboard";
    } catch (err: any) {
      setErrorMsg(err?.message ?? t('auth.register.error.complete'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      {step === "form" ? (
        <form onSubmit={handleSendCode} className="grid gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="name">
              {t('auth.register.fullName')}
            </label>
            <Input
              id="name"
              value={fullName}
              onChange={(e: any) => setFullName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="email">
              {t('auth.register.email')}
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="password">
              {t('auth.register.password')}
            </label>
            <Input
              id="password"
              type="password"
              showPasswordToggle
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {duplicateEmail && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                {t('auth.register.duplicateEmail')}
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
              >
                {t('auth.register.goToLogin')}
              </Link>
            </div>
          )}
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          {infoMsg && <p className="text-sm text-gray-600">{infoMsg}</p>}

          <Button type="submit" disabled={isLoading} isLoading={isLoading} className="w-full">
            {isLoading ? t('auth.register.sending') : t('auth.register.sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndCreate} className="grid gap-4">
          <p className="text-sm text-gray-600">
            {t('auth.register.codeSentTo')} <strong>{email.trim().toLowerCase()}</strong>
          </p>

          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="code">
              {t('auth.register.code')}
            </label>
            <Input
              id="code"
              value={code}
              onChange={(e: any) => setCode(e.target.value)}
              disabled={isLoading}
              required
              inputMode="numeric"
            />
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          {infoMsg && <p className="text-sm text-gray-600">{infoMsg}</p>}

          <Button type="submit" disabled={isLoading} isLoading={isLoading} className="w-full">
            {isLoading ? t('auth.register.creating') : t('auth.register.verify')}
          </Button>

          <button
            type="button"
            className="text-sm underline opacity-80"
            disabled={isLoading}
            onClick={() => {
              setStep("form");
              setCode("");
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            {t('auth.register.back')}
          </button>
        </form>
      )}
    </div>
  );
}
