/**
 * @fileoverview Zod schemas for authentication forms.
 * @module lib/validations/auth.schema
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

/**
 * Hybrid register: Step 1 (request OTP)
 */
export const registerRequestSchema = z.object({
  full_name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100),
  email: z.string().email('Correo electrónico inválido'),
  phone: z.string().optional(),
});

/**
 * Hybrid register: Step 2 (verify OTP)
 */
export const otpSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, 'El código debe ser de 6 dígitos'),
});

/**
 * Hybrid register: Step 3 (set password)
 */
export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterRequestValues = z.infer<typeof registerRequestSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type SetPasswordValues = z.infer<typeof setPasswordSchema>;
