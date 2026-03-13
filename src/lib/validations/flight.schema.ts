/**
 * @fileoverview Zod schemas for flight search and filtering.
 * @module lib/validations/flight.schema
 */
import { z } from 'zod';

/* ── Helpers ─────────────────────────────────────── */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns today at 00:00 local (no time component). */
function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Parse YYYY-MM-DD as local date (avoids UTC offset issues). */
function parseLocalDate(v: string): Date {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ── Schema ──────────────────────────────────────── */

export const flightSearchSchema = z
  .object({
    origin: z.string().length(3, 'Codigo IATA requerido (3 letras)'),
    destination: z.string().length(3, 'Codigo IATA requerido (3 letras)'),
    departure_date: z
      .string()
      .min(1, 'Fecha de ida requerida')
      .regex(DATE_RE, 'Formato de fecha invalido (YYYY-MM-DD)'),
    return_date: z
      .string()
      .regex(DATE_RE, 'Formato de fecha invalido (YYYY-MM-DD)')
      .optional()
      .or(z.literal('')),
    passengers: z.coerce.number().int().min(1).max(9),
    cabinClass: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy'),
  })
  /* origin !== destination */
  .refine((d) => d.origin !== d.destination, {
    message: 'El origen y destino no pueden ser iguales',
    path: ['destination'],
  })
  /* departure must be today or later */
  .refine(
    (d) => {
      if (!DATE_RE.test(d.departure_date)) return true; // skip if format invalid
      return parseLocalDate(d.departure_date) >= todayLocal();
    },
    { message: 'La fecha de ida no puede ser en el pasado', path: ['departure_date'] },
  )
  /* departure must be within 1 year */
  .refine(
    (d) => {
      if (!DATE_RE.test(d.departure_date)) return true;
      const maxDate = todayLocal();
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      return parseLocalDate(d.departure_date) <= maxDate;
    },
    { message: 'La fecha de ida no puede ser mayor a 1 año', path: ['departure_date'] },
  )
  /* return date must be on or after departure */
  .refine(
    (d) => {
      if (!d.return_date || !DATE_RE.test(d.return_date)) return true;
      if (!DATE_RE.test(d.departure_date)) return true;
      return parseLocalDate(d.return_date) >= parseLocalDate(d.departure_date);
    },
    { message: 'La fecha de vuelta debe ser igual o posterior a la de ida', path: ['return_date'] },
  )
  /* return date must be within 1 year */
  .refine(
    (d) => {
      if (!d.return_date || !DATE_RE.test(d.return_date)) return true;
      const maxDate = todayLocal();
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      return parseLocalDate(d.return_date) <= maxDate;
    },
    { message: 'La fecha de vuelta no puede ser mayor a 1 año', path: ['return_date'] },
  );

export type FlightSearchFormValues = z.infer<typeof flightSearchSchema>;
