"use client";

import * as React from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { authService } from "@/services/auth.service";

export default function RegisterForm() {
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
    if (!fullName.trim()) return setErrorMsg("Nombre completo es requerido.");
    if (!normalizedEmail) return setErrorMsg("Email es requerido.");
    if (!password) return setErrorMsg("Contraseña es requerida.");

    setIsLoading(true);
    try {
      await authService.signUpStepOne(normalizedEmail);
      setStep("otp");
      setInfoMsg("Te enviamos un código a tu correo. Pégalo aquí para completar el registro.");
    } catch (err: any) {
      if (err?.status === 409) {
        setDuplicateEmail(true);
      } else {
        setErrorMsg(err?.message ?? "No se pudo enviar el código.");
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
    if (!code.trim()) return setErrorMsg("Código es requerido.");

    setIsLoading(true);
    try {
      await authService.verifySignupOtp(normalizedEmail, code.trim(), fullName.trim(), password);

      // ✅ Cuenta creada + sesión iniciada — full reload para que las cookies se envíen al middleware
      window.location.href = "/user/dashboard";
    } catch (err: any) {
      setErrorMsg(err?.message ?? "No se pudo completar el registro.");
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
              Nombre Completo
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
              Correo
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
              Contraseña
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
                Ya existe una cuenta con este correo electrónico.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
              >
                Ir a Iniciar Sesion
              </Link>
            </div>
          )}
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          {infoMsg && <p className="text-sm text-gray-600">{infoMsg}</p>}

          <Button type="submit" disabled={isLoading} isLoading={isLoading} className="w-full">
            {isLoading ? "Enviando código..." : "Enviar código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndCreate} className="grid gap-4">
          <p className="text-sm text-gray-600">
            Enviamos un código a <strong>{email.trim().toLowerCase()}</strong>
          </p>

          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="code">
              Código
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
            {isLoading ? "Creando cuenta..." : "Verificar y crear cuenta"}
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
            Volver
          </button>
        </form>
      )}
    </div>
  );
}
