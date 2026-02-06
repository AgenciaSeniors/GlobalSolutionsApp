/**
 * @fileoverview Auto-generated types from Supabase schema.
 *               Regenerate with: npm run db:generate
 * @module types/database.types
 *
 * This file is a placeholder. Run the following command after
 * configuring your Supabase project ID to generate real types:
 *
 *   npx supabase gen types typescript \
 *     --project-id YOUR_PROJECT_ID \
 *     > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: 'client' | 'agent' | 'admin';
          avatar_url: string | null;
          loyalty_points: number;
          agent_code: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at' | 'loyalty_points' | 'is_active'> & {
          loyalty_points?: number;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      // Additional tables follow the same pattern.
      // Generated types will include all tables automatically.
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
