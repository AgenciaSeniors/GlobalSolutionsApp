// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Reemplaza estos valores con los de tu proyecto en el panel de Supabase
// (Project Settings > API)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase: Falta la URL o la Anon Key en las variables de entorno.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);