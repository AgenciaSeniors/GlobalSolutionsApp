// src/components/providers/AuthProvider.tsx
/**
 * @fileoverview React context provider that exposes auth session state
 *               and listens for Supabase auth changes.
 *
 * 🔧 FIX: Usa onAuthStateChange como única fuente de verdad.
 *          getSession() solo para el estado inicial (evita race conditions).
 *          Tolerante a profile = null (RLS, fila faltante, etc.)
 */
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/models';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔧 FIX: fetchProfile memoizado, con manejo de errores robusto.
  // Lee vía /api/me/profile (service-role) porque las columnas sensibles del
  // perfil ya no son legibles por el navegador.
  const fetchProfile = useCallback(
    async (_uid: string) => {
      try {
        const res = await fetch('/api/me/profile');
        if (!res.ok) {
          console.warn('[AuthProvider] Profile fetch error:', res.status);
          setProfile(null);
        } else {
          const { profile: data } = await res.json();
          setProfile((data as Profile) ?? null);
        }
      } catch (err) {
        console.warn('[AuthProvider] Profile fetch exception:', err);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // 🔧 FIX: Obtener sesión inicial de forma síncrona con getSession
    // (no getUser que hace network request)
    // Luego onAuthStateChange maneja todo lo demás
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id);
      } else {
        setIsLoading(false);
      }
    });

    // 🔧 FIX: onAuthStateChange como fuente de verdad para cambios
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const u = session?.user ?? null;
      setUser(u);

      if (u) {
        fetchProfile(u.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }

      // Log para debug en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthProvider] Auth event:', event, u?.email ?? 'no user');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
