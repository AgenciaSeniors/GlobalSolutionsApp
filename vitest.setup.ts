// vitest.setup.ts
import '@testing-library/jest-dom';

// Opcional: Mockear variables de entorno para que los tests no fallen si faltan
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';