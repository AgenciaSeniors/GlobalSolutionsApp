// src/components/providers/AuthProvider.tsx
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
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
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial session check and sync with server
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          // sincronizar cookie server-side (fire-and-forget)
          fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session }),
          }).catch(() => {});

          await fetchProfile(u.id);
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    })();

    // Listen for auth changes
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        // sincronizar server cookies al hacer sign in
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session }),
        }).catch(() => {});

        fetchProfile(u.id);
      } else {
        // sincronizar sign out en server
        fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: null }),
        }).catch(() => {});

        setProfile(null);
        setIsLoading(false);
      }
    });

    const subscription = data?.subscription;

    return () => {
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    setProfile(data as Profile | null);
    setIsLoading(false);
  }

  return (
    <AuthContext.Provider value={{ user, profile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
