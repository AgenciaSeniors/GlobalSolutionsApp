/**
 * @fileoverview Zod schemas for booking creation and passenger data.
 * @module lib/validations/booking.schema
 */
import { z } from 'zod';

const passengerSchema = z.object({
  first_name: z.string().min(2, 'Nombre requerido'),
  last_name: z.string().min(2, 'Apellido requerido'),
  date_of_birth: z.string().min(1, 'Fecha de nacimiento requerida'),
  nationality: z.string().length(3, 'Código de país ISO (3 letras)'),
  passport_number: z
    .string()
    .min(5, 'Número de pasaporte inválido')
    .max(20),
  passport_expiry_date: z.string().min(1, 'Fecha de expiración requerida'),
});

export const createBookingSchema = z.object({
  flight_id: z.string().uuid(),
  passengers: z.array(passengerSchema).min(1).max(9),
});

export type PassengerFormValues = z.infer<typeof passengerSchema>;
export type CreateBookingFormValues = z.infer<typeof createBookingSchema>;
