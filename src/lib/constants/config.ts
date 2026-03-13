/**
 * @fileoverview Shared application configuration.
 * @module lib/constants/config
 */

export const APP_CONFIG = {
  name: 'Global Solutions Travel',
  tagline: 'Tu próxima aventura comienza aquí',
  supportEmail: 'soporte@globalsolutionstravel.com',
  maxPassengersPerBooking: 9,
  defaultCurrency: 'USD',
  defaultLocale: 'es',
} as const;

export const AIRPORTS = [
  { code: 'HAV', city: 'La Habana', country: 'Cuba' },
  { code: 'IST', city: 'Estambul', country: 'Turquía' },
  { code: 'MIA', city: 'Miami', country: 'EE.UU.' },
  { code: 'MAD', city: 'Madrid', country: 'España' },
  { code: 'CUN', city: 'Cancún', country: 'México' },
  { code: 'PTY', city: 'Panamá', country: 'Panamá' },
  { code: 'BOG', city: 'Bogotá', country: 'Colombia' },
  { code: 'MEX', city: 'Ciudad de México', country: 'México' },
  // src/lib/constants/config.ts
  { code: 'JFK', city: 'Nueva York', country: 'EE.UU.' },

  // Mantén los otros que ya tienes...
] as const;

