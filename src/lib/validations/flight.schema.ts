/**
 * @fileoverview Zod schemas for flight search and filtering.
 * @module lib/validations/flight.schema
 */
import { z } from 'zod';

export const flightSearchSchema = z.object({
  origin: z.string().length(3, 'Código IATA requerido (3 letras)'),
  destination: z.string().length(3, 'Código IATA requerido (3 letras)'),
  departure_date: z.string().min(1, 'Fecha de ida requerida'),
  return_date: z.string().optional(),
  passengers: z.coerce.number().int().min(1).max(9),
});

export type FlightSearchFormValues = z.infer<typeof flightSearchSchema>;
