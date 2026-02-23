'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants/routes';
import { Lock, CheckCircle } from 'lucide-react';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      // Redirigir al login despues de unos segundos
      setTimeout(() => {
        router.push(ROUTES.LOGIN);
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar contraseña';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-brand-600" />
          <h1 className="text-2xl font-bold">Nueva Contraseña</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ya puedes restaurar tu contraseña. Ingresa una nueva para acceder a tu cuenta.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 text-center flex flex-col items-center">
            <CheckCircle className="mb-2 h-8 w-8 text-emerald-500" />
            Contraseña actualizada exitosamente. Redirigiendo al login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-neutral-700">
                Escribe la nueva contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" isLoading={isLoading} className="w-full">
              Actualizar Contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}