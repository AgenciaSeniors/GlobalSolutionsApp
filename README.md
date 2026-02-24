# ✈️ Global Solutions Travel

> Ecosistema multiplataforma de reserva de vuelos internacionales, renta de autos y gestión de agentes B2B, con seguridad de nivel bancario.

![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Stripe](https://img.shields.io/badge/Stripe-16.12-635BFF?logo=stripe)
![PayPal](https://img.shields.io/badge/PayPal-REST_v2-00457C?logo=paypal)
![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)

---

## 📊 Estado del Proyecto

| Módulo | Progreso | Estado |
|--------|----------|--------|
| Motor de Vuelos | 55% | ⚠️ Parcial — falta API externa (Duffel/Amadeus) |
| Pagos y Precios | 85% | ✅ Stripe + PayPal + Zelle + Reembolsos |
| Seguridad Fortress | 60% | ⚠️ RLS + pgcrypto listos, faltan RPCs PII |
| Autenticación y Roles | 90% | ✅ OTP + JWT + Middleware + 3 roles |
| Gestión de Agentes | 90% | ✅ Comisiones + Tickets threaded + Cotizador |
| Lealtad y Reseñas | 85% | ✅ 4 niveles + puntos auto + moderación |
| Renta de Autos | 70% | ✅ Inventario + booking + gestión admin |
| Documentos / Email | 80% | ✅ PDF vouchers + 10 templates Resend |
| Asistencia IA | 80% | ✅ OpenAI + PNR lookup + handoff realtime |

**Progreso general: ~72%** · Última actualización: Febrero 2026

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.15 |
| Lenguaje | TypeScript (strict mode) | 5.6 |
| UI | React + Tailwind CSS | 18.3.1 / 3.4.13 |
| Base de datos | Supabase (PostgreSQL + Auth + Storage + Realtime) | 2.75.5 |
| Pagos | Stripe | 16.12 |
| Pagos | PayPal REST API v2 | — |
| Email | Resend | 6.9.1 |
| IA Chat | OpenAI API | gpt-4o-mini |
| PDF | @react-pdf/renderer | 4.3.2 |
| Validación | Zod | 3.23.8 |
| Iconos | Lucide React | 0.446 |
| Toasts | Sonner | 1.5.0 |
| Mobile | Capacitor | 8.0.2 |
| Tests unitarios | Vitest | 4.0.18 |
| Tests E2E | Playwright | 1.58.2 |
| Logging | Pino | 10.3.1 |
| Observabilidad | Sentry + OpenTelemetry | 10.39.0 |

---

## 📐 Arquitectura del Proyecto

```
src/
├── app/                          ← Next.js 14 App Router
│   ├── (auth)/                   ← Login, Register, OTP, Forgot Password
│   ├── (public)/                 ← Landing, Vuelos, Autos, Ofertas, Checkout, Pay
│   ├── (dashboard)/
│   │   ├── admin/dashboard/
│   │   │   ├── agents/           ← Gestión de gestores
│   │   │   ├── bookings/         ← Todas las reservas
│   │   │   ├── cars/             ← Inventario de autos (CRUD)
│   │   │   ├── emission/         ← Emisión de boletos con PNR
│   │   │   ├── flights/          ← Inventario de vuelos & markup
│   │   │   ├── markup/           ← Reglas de markup por vuelo
│   │   │   ├── news/             ← Publicar noticias para agentes
│   │   │   ├── offers/           ← Ofertas visuales (editor)
│   │   │   ├── reviews/          ← Moderación de reseñas (+ auto-puntos)
│   │   │   ├── settings/         ← Configuración global
│   │   │   └── tickets/          ← Tickets de soporte (threaded)
│   │   ├── agent/dashboard/
│   │   │   ├── bookings/         ← Reservas asignadas
│   │   │   ├── commissions/      ← Comisiones (pending/approved/paid)
│   │   │   ├── news/             ← Muro de noticias
│   │   │   ├── settings/         ← Configuración del agente
│   │   │   └── tickets/          ← Tickets propios con thread
│   │   └── user/dashboard/
│   │       ├── become-agent/     ← Solicitud de alta como agente
│   │       ├── bookings/         ← Mis reservas
│   │       ├── loyalty/          ← Puntos de lealtad (4 niveles)
│   │       ├── reviews/          ← Mis reseñas
│   │       └── settings/         ← Configuración de perfil
│   └── api/
│       ├── admin/
│       │   ├── reviews/          ← PATCH: aprobar/rechazar reseña
│       │   └── settings/         ← POST: configuración global
│       ├── agent/bookings/       ← GET: reservas asignadas
│       ├── auth/
│       │   ├── complete-register/
│       │   ├── forgot-password/
│       │   ├── request-otp/
│       │   ├── validate-credentials/
│       │   └── verify-otp/
│       ├── bookings/
│       │   ├── pdf/              ← Generar voucher PDF
│       │   ├── preview/          ← Preview de precio
│       │   └── pricing-preview/  ← Desglose por gateway
│       ├── chat/                 ← OpenAI + PNR lookup + rate limit
│       ├── dev/emit-voucher/     ← Dev: generación manual de voucher
│       ├── flights/
│       │   ├── airports/         ← Listado completo de aeropuertos
│       │   ├── autocomplete/     ← Autocompletado IATA/ciudad
│       │   ├── persist/          ← Admin: agregar vuelos
│       │   └── search/
│       │       └── [sessionId]/  ← GET: resultado de sesión de búsqueda
│       ├── notifications/        ← POST: envío de emails (test)
│       ├── payments/
│       │   ├── create-intent/    ← Stripe PaymentIntent
│       │   ├── paypal/
│       │   │   └── create-order/
│       │   │       └── capture-order/
│       │   ├── refund/           ← Reembolso dual Stripe + PayPal
│       │   └── zelle/
│       │       ├── confirm/
│       │       ├── reject/
│       │       └── request/
│       ├── reviews/
│       │   └── trigger/          ← Cron: solicitar reseñas post-viaje
│       └── webhooks/
│           ├── paypal/           ← Firma verificada + idempotente
│           └── stripe/           ← Firma verificada + idempotente
│
├── components/                   ← 36+ componentes React
│   ├── features/
│   │   ├── chat/                 ← ChatWidget (IA flotante)
│   │   ├── flights/              ← FlightCard, FlightFilters, FlightLegTabs, ResultsList
│   │   ├── home/                 ← HeroSection, AboutSection, ServicesSection, OffersCarousel
│   │   ├── offers/               ← OffersCalendarExplorer, ExclusiveOfferCard
│   │   ├── payments/             ← PaymentSelector, StripeCheckout, PayPalCheckout
│   │   └── reviews/              ← ReviewCard, rating display
│   ├── forms/                    ← FlightSearchForm, MultiLegEditor, LoginForm, BookingForm, AirportAutocomplete
│   ├── layout/                   ← Navbar, Footer, Sidebar, Header
│   ├── providers/                ← AuthProvider, ToastProvider
│   └── ui/                       ← Button, Card, Input, Badge, Modal, Skeleton, FlightLoader
│
├── hooks/                        ← 7 custom hooks
│   ├── useAgentNews.ts           ← Feed de noticias con Supabase Realtime
│   ├── useAppSettings.ts         ← Configuración global
│   ├── useAuth.ts                ← Sesión + login/logout
│   ├── useBooking.ts             ← Flujo de reserva
│   ├── useFlightSearch.ts        ← Búsqueda 2 fases + polling
│   ├── useMulticitySelection.ts  ← Selección de vuelos multidestino
│   └── useNotifications.ts       ← Toasts via Sonner
│
├── lib/
│   ├── email/                    ← Resend + templates + notifications
│   ├── flights/                  ← Orchestrator + providers + circuit breaker
│   ├── payments/                 ← refundCalculator + refundEngine
│   ├── pdf/                      ← bookingVoucher.tsx (@react-pdf/renderer)
│   ├── pricing/                  ← priceEngine (centavos), passengerRules, bookingPricing
│   ├── supabase/                 ← client.ts, server.ts, admin.ts
│   └── validations/              ← Esquemas Zod compartidos
│
├── services/                     ← 12 servicios de negocio
│   ├── agent.service.ts
│   ├── agentNews.service.ts
│   ├── audit.service.ts
│   ├── auth.service.ts
│   ├── bookings.service.ts
│   ├── commission.service.ts
│   ├── flights.service.ts
│   ├── loyalty.service.ts
│   ├── otp.service.ts
│   ├── payments.service.ts
│   ├── reviews.service.ts
│   └── tickets.service.ts
│
└── types/                        ← TypeScript types + database.types.ts

supabase/
├── migrations/                   ← 18 migraciones SQL
└── config.toml
```

### Principios de Diseño

- **Clean Architecture**: UI → Hooks → Services → Supabase
- **Server-Side Source of Truth**: El frontend NUNCA calcula precios ni montos
- **Integer Arithmetic**: Todos los cálculos financieros en centavos (sin floating-point)
- **Idempotencia**: Webhooks con `ON CONFLICT DO NOTHING` vía RPCs dedicados
- **DB Triggers**: Comisiones, puntos de lealtad y auditoría son automáticos
- **Circuit Breaker**: Proveedores de vuelos con fallback encadenado
- **RLS en todo**: Cada tabla con Row Level Security activo

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js ≥ 18
- Cuenta [Supabase](https://supabase.com) (plan Free o Pro)
- Cuenta [Stripe](https://stripe.com) (modo sandbox para desarrollo)
- Cuenta [PayPal Developer](https://developer.paypal.com) (sandbox)
- Cuenta [Resend](https://resend.com) (capa gratuita disponible)
- API Key [OpenAI](https://platform.openai.com) (para el chat IA)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/global-solutions-travel.git
cd global-solutions-travel
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
# Edita .env.local con tus credenciales
```

Ver sección [Variables de Entorno](#-variables-de-entorno) más abajo.

### 3. Aplicar migraciones en Supabase

Ejecuta las migraciones en orden en el **SQL Editor** de Supabase:

```
supabase/migrations/001_complete_schema.sql
supabase/migrations/002_extended_schema.sql
supabase/migrations/002_spec_compliance.sql
supabase/migrations/003_app_settings.sql
supabase/migrations/003_fix_agent_news_rls.sql
supabase/migrations/004_payment_events_and_refunds.sql
supabase/migrations/005_modules_5_6_completion.sql
supabase/migrations/006_flight_search_sessions_and_breaker.sql
supabase/migrations/006_review_requested_at.sql
supabase/migrations/007_flight_search_cache_invalidation.sql
supabase/migrations/008_airports_search_optimization.sql
supabase/migrations/009_airports_insert_policy.sql
supabase/migrations/010_cars_module_complete.sql
supabase/migrations/011_try_lock_search_session.sql
supabase/migrations/012_multicity_booking_itineraries.sql
supabase/migrations/013_chat_rate_limiting.sql
supabase/migrations/013_fix_gateway_fees_and_agent_markup.sql
supabase/migrations/014_fix_booking_passengers_rls.sql
```

### 4. Habilitar Realtime en Supabase

En el panel de Supabase → **Database → Replication**, habilita la tabla `chat_messages` para el chat en tiempo real.

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 🔑 Variables de Entorno

```bash
# ── Supabase ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Encriptación PII ────────────────────────────────────────────────────────
ENCRYPTION_MASTER_KEY=<string de 64+ caracteres aleatorios>
PASSPORT_ENCRYPTION_KEY=<string de 64+ caracteres aleatorios>

# ── Stripe ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── PayPal ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_ENV=sandbox     # o 'live' en producción

# ── Email (Resend) ──────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM="Global Solutions Travel <no-reply@tudominio.com>"

# ── IA Chat (OpenAI) ────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# ── App Config ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=5356621636    # sin + ni espacios

# ── Búsqueda de Vuelos (RapidAPI / SkyScrapper) ─────────────────────────────
RAPIDAPI_KEY=...
RAPIDAPI_HOST=flights-sky.p.rapidapi.com
```

---

## 🗄️ Base de Datos (Supabase PostgreSQL)

### Tablas (21)

| Grupo | Tablas |
|-------|--------|
| **Usuarios** | `profiles`, `auth.users` (nativo) |
| **Vuelos** | `airlines`, `airports`, `flights` |
| **Reservas** | `bookings`, `booking_passengers`, `booking_itineraries` |
| **Autos** | `car_rentals`, `car_rental_bookings` |
| **Agentes** | `agent_news`, `agent_tickets`, `agent_ticket_messages`, `agent_commissions` |
| **Usuarios** | `reviews`, `loyalty_transactions`, `quotation_requests` |
| **Promociones** | `special_offers` |
| **Sistema** | `chat_conversations`, `chat_messages`, `payment_events`, `app_settings`, `audit_logs`, `chat_rate_limits` |

### Triggers Automáticos (7)

| Trigger | Tabla | Qué hace |
|---------|-------|---------|
| `handle_new_user` | `auth.users` | Crea `profiles` automáticamente al registrarse |
| `audit_bookings` | `bookings` | Log inmutable de INSERT/UPDATE/DELETE en `audit_logs` |
| `auto_generate_commission` | `bookings` | Genera comisión del 5% cuando booking → `confirmed` |
| `auto_award_booking_points` | `bookings` | Otorga 1 punto por cada $1 USD al completar reserva |
| `auto_award_review_points` | `reviews` | Otorga 50 pts (texto) o 100 pts (con fotos) al aprobar reseña |
| `auto_ticket_code` | `agent_tickets` | Genera código único `TK-XXXXXX` |
| `update_*_updated_at` | Varias | Actualiza timestamp `updated_at` automáticamente |

### RPCs (Funciones de servidor)

| Función | Descripción |
|---------|-------------|
| `add_loyalty_points(user_id, points, reason, ref_type, ref_id)` | Otorga/deduce puntos atómicamente + actualiza `profiles.loyalty_points` |
| `encrypt_passport(text)` | Encripta PII con pgp_sym_encrypt (AES-256) |
| `decrypt_passport(bytea)` | Desencripta PII (solo admins) |
| `log_payment_event_once(...)` | Idempotente para webhooks genérico |
| `log_stripe_event_once(...)` | Wrapper Stripe |
| `log_paypal_event_once(...)` | Wrapper PayPal |
| `increment_chat_rate_limit(key, limit)` | Rate limiting para chat IA (5 msg/30s) |
| `try_lock_search_session(...)` | Bloqueo de sesión de búsqueda (anti race-condition) |
| `current_user_role()` | Retorna el rol del usuario actual (SECURITY DEFINER) |

### Vista

| Vista | Descripción |
|-------|-------------|
| `agent_commission_summary` | Resumen de comisiones por agente: total, pendiente, pagado |

### Row Level Security (RLS)

RLS habilitado en las **21 tablas**:
- **Clientes**: Solo ven sus propios bookings, reviews y puntos
- **Agentes**: Ven bookings asignados, sus propias comisiones y tickets
- **Admins**: Acceso completo vía `current_user_role() = 'admin'`
- **Operaciones privilegiadas**: Usan `createAdminClient()` (service role key) para bypassear RLS

### Encriptación PII

Los números de pasaporte se almacenan como `BYTEA` encriptados con `pgp_sym_encrypt`:
- Función: `encrypt_passport(text)` / `decrypt_passport(bytea)`
- Clave: `PASSPORT_ENCRYPTION_KEY` (server-only, nunca llega al cliente)

---

## 📋 Migraciones SQL

| Archivo | Descripción |
|---------|-------------|
| `001_complete_schema.sql` | Schema core: profiles, flights, bookings, passengers, airports, airlines, reviews, car rentals, RLS completo, seed data |
| `002_extended_schema.sql` | Extensiones: offers, tickets, chat, loyalty_transactions, commissions |
| `002_spec_compliance.sql` | Ajustes de cumplimiento normativo |
| `003_app_settings.sql` | Tabla `app_settings` para configuración global (markup, fees, SLAs) |
| `003_fix_agent_news_rls.sql` | Corrección de políticas RLS en `agent_news` |
| `004_payment_events_and_refunds.sql` | Tabla `payment_events` + RPCs idempotentes para webhooks |
| `005_modules_5_6_completion.sql` | Completar módulos 5 y 6: triggers de comisiones, auto-award puntos |
| `006_flight_search_sessions_and_breaker.sql` | Sesiones de búsqueda de vuelos + circuit breaker |
| `006_review_requested_at.sql` | Columna `review_requested_at` en bookings |
| `007_flight_search_cache_invalidation.sql` | Invalidación de caché de búsqueda |
| `008_airports_search_optimization.sql` | Índices GIN para búsqueda de aeropuertos por nombre/IATA |
| `009_airports_insert_policy.sql` | Política RLS para inserción de aeropuertos (admin only) |
| `010_cars_module_complete.sql` | Módulo de renta de autos completo con RLS |
| `011_try_lock_search_session.sql` | RPC `try_lock_search_session` anti race-conditions |
| `012_multicity_booking_itineraries.sql` | Tabla `booking_itineraries` para vuelos multidestino |
| `013_chat_rate_limiting.sql` | Tabla `chat_rate_limits` + RPC para rate limiting de chat |
| `013_fix_gateway_fees_and_agent_markup.sql` | Corrección de cálculo de tarifas de gateway y markup de agentes |
| `014_fix_booking_passengers_rls.sql` | Corrección de políticas RLS en `booking_passengers` |

---

## 💳 Sistema de Pagos

### Motor de Precios (priceEngine)

Todo cálculo financiero ocurre en el servidor, en enteros (centavos):

```
Tarifa base × Multiplicador de edad → Subtotal por pasajero
  × Número de pasajeros → Subtotal por tramo
  + Buffer de volatilidad (3%) → Total pre-fee
  + Tarifa de gateway → Total final

Multiplicadores por edad:
  Infante (0-2 años):  10% de la tarifa base
  Niño (2-12 años):    75% de la tarifa base
  Adulto (12+ años):  100% de la tarifa base

Tarifas de gateway:
  Stripe:  2.9% + $0.30 fijo
  PayPal:  3.49% + $0.49 fijo
  Zelle:   1.5% (configurable en app_settings)
```

### Flujos de Pago

**Stripe (PaymentIntent):**
1. `POST /api/payments/create-intent` → PaymentIntent + `client_secret`
2. Cliente confirma con Stripe Elements
3. Webhook `payment_intent.succeeded` → booking `payment_status = 'paid'`
4. Idempotencia vía `log_stripe_event_once()` RPC

**PayPal (Orders API v2):**
1. `POST /api/payments/paypal/create-order` → Order ID
2. Usuario aprueba en PayPal
3. `POST /api/payments/paypal/create-order/capture-order` → Captura fondos
4. Webhook valida y actualiza booking
5. Idempotencia vía `log_paypal_event_once()` RPC

**Zelle (Transferencia manual):**
1. `POST /api/payments/zelle/request` → Instrucciones de transferencia
2. Usuario transfiere y notifica
3. Admin confirma: `POST /api/payments/zelle/confirm` o rechaza: `POST /api/payments/zelle/reject`

### Política de Reembolsos

| Escenario | Monto reembolsado |
|-----------|-------------------|
| Solicitud del cliente, < 48h antes de salida | 100% del costo (sin gateway fee) |
| Solicitud del cliente, > 48h antes de salida | 50% del costo (sin gateway fee) |
| Cancelación por la aerolínea | 100% + $20 de compensación |

> ⚠️ Las tarifas de gateway **nunca** se reembolsan (regla de negocio en `refundEngine`).

### Auditoría de Webhooks

Todos los eventos de pago se registran en la tabla `payment_events`:
- `provider`: stripe | paypal | zelle
- `event_id` + `event_type`: garantizan idempotencia
- `payload`: datos completos del webhook
- `booking_id`: referencia cruzada

---

## ✈️ Motor de Búsqueda de Vuelos

### Arquitectura Orchestrator + Providers

```
useFlightSearch (hook)
    └── flightsService.startSearchSession()
            └── POST /api/flights/search
                    └── flightsOrchestrator (v6)
                            ├── agencyInventoryProvider  ← Vuelos propios (DB)
                            ├── skyScrapperProvider      ← RapidAPI (externo)
                            ├── seedDbProvider           ← Datos de prueba
                            └── externalStubProvider     ← Mock provider
```

**Características:**
- **Circuit breaker**: deshabilita proveedores con fallos reiterados
- **Deduplicación**: por (airline code + flight number + departure time)
- **Target**: 20 resultados por tramo
- **Session locking**: `try_lock_search_session()` previene race conditions

### Búsqueda en 2 Fases

```
Fase 1 → POST /api/flights/search
         Retorna inmediatamente con: sessionId + resultados cacheados o estado 'pending'

Fase 2 → GET /api/flights/search/{sessionId}
         Polling hasta completar (timeout: 45s, intervalo: 1.5s)
```

### Soporte Multidestino

- Formato `{ legs: [{ origin, destination, departure_date }], passengers, ... }`
- Resultados indexados por `legIndex`
- Itinerarios almacenados en tabla `booking_itineraries`
- `trip_type`: `'oneway'` | `'roundtrip'` | `'multicity'`

### Filtros Disponibles

- Rango de precio (minPrice / maxPrice)
- Aerolíneas (array de códigos IATA)
- Máximo de escalas (maxStops)
- Rango horario de salida (departureTimeRange)

---

## 👥 Gestión de Agentes (Módulo 5)

### Sistema de Comisiones

- **Auto-generación**: Trigger `auto_generate_commission` crea comisión del 5% cuando `booking_status → 'confirmed'`
- **Flujo**: `pending` → `approved` → `paid`
- **Vista agente**: `/agent/dashboard/commissions` con resumen financiero
- **Vista admin**: Aprobación y marcado de pago
- **Tasa configurable** vía `app_settings.default_commission_rate`

### Tickets de Soporte (Conversaciones Threaded)

- Estructura: `agent_tickets` (cabecera) → `agent_ticket_messages` (N mensajes)
- **Categorías**: general, booking_issue, payment, technical, complaint, suggestion
- **Prioridades**: low, medium, high, urgent
- **Flujo de estado**: `open` → `in_progress` → `waiting_response` → `resolved` → `closed`
- Código auto-generado: `TK-XXXXXX`
- Notas internas (flag `is_internal`, solo visibles para admin)

### Cotizador Rápido

- Inputs IATA + fecha en el dashboard del agente
- Redirige directamente a `/flights/search` con parámetros
- Muestra precios netos (sin markup): "MODO AGENTE: NETO"

### Muro de Noticias

- Admin publica actualizaciones, promociones y alertas
- Artículos fijables (pinned) con categorías coloreadas
- Componente `AgentNewsWall` reutilizable
- Actualizaciones en tiempo real vía Supabase Realtime

---

## 🏆 Programa de Lealtad (Módulo 6)

### 4 Niveles de Membresía

| Nivel | Puntos | Badge |
|-------|--------|-------|
| 🥉 Bronce | 0 – 499 pts | Gris |
| 🥈 Plata | 500 – 1,999 pts | Plateado |
| 🥇 Oro | 2,000 – 4,999 pts | Dorado |
| 💎 Platino | 5,000+ pts | Morado |

### Obtención Automática (DB Triggers)

| Evento | Puntos | Trigger |
|--------|--------|---------|
| Reserva completada | 1 pt por cada $1 USD gastado | `auto_award_booking_points` |
| Reseña aprobada (solo texto) | 50 pts | `auto_award_review_points` |
| Reseña aprobada (con fotos) | 100 pts | `auto_award_review_points` |

### Página de Lealtad (`/user/dashboard/loyalty`)

- Tarjeta hero: nivel actual + balance + barra de progreso al siguiente nivel
- **Historial**: transacciones con tipo (booking, review, promo, canje), fecha y puntos
- **Estadísticas**: total ganados, canjeados, número de transacciones
- **Cómo ganar**: guía visual de los 4 niveles y métodos de acumulación

---

## ⭐ Sistema de Reseñas

**Flujo completo:**
1. Solo usuarios con `booking_status = 'completed'` y `payment_status = 'paid'` pueden reseñar
2. Formulario: 1-5 estrellas + título (opcional) + comentario + fotos (opcionales)
3. Se almacena con `status = 'pending_approval'`
4. Admin modera en `/admin/dashboard/reviews` vía API route seguro (`PATCH /api/admin/reviews`)
5. Al aprobar: trigger otorga puntos automáticamente y la reseña se publica
6. Al rechazar: la reseña permanece privada

**Cron endpoint** (`POST /api/reviews/trigger`):
- Ejecutar diariamente (externo: cron job o scheduler)
- Detecta bookings con `return_date = ayer` y `review_requested = false`
- Envía email de solicitud de reseña vía Resend
- Marca `review_requested = true` + `review_requested_at`
- Delay configurable vía `app_settings.review_request_delay_days`

---

## 🚗 Renta de Autos (Módulo 7)

- **Inventario**: tabla `car_rentals` (nombre, descripción, precio diario, features, fotos)
- **Reservas**: tabla `car_rental_bookings` con fechas y total calculado
- **Admin**: CRUD completo en `/admin/dashboard/cars` + `/admin/dashboard/cars/new` + `/admin/dashboard/cars/[id]/edit`
- **Público**: Listado en `/cars` y detalle en `/cars/[id]`

---

## 🤖 Asistencia IA (Módulo 8)

### Arquitectura del Chat

```
ChatWidget (frontend flotante)
    └── POST /api/chat
            ├── Filtro in-scope (rechaza preguntas fuera del dominio)
            ├── Rate limiting (5 msg/30s via increment_chat_rate_limit RPC)
            ├── PNR Lookup → busca en bookings si usuario autenticado pregunta por reserva
            ├── OpenAI API (gpt-4o-mini, historial de 6 mensajes)
            └── Persistencia en chat_conversations + chat_messages
```

### Medidas de Control de Costo

1. **Filtro in-scope**: solo responde sobre vuelos, reservas, pagos y servicios de la agencia
2. **Rate limit**: 5 mensajes por 30 segundos por usuario/IP
3. **Historial corto**: envía solo los últimos 6 mensajes al modelo
4. **Max tokens**: salida limitada para reducir costo
5. Estimado: **~$20/mes** a tráfico moderado

### Escalado a Agente Humano

- El chat detecta cuando el usuario necesita atención humana
- Cambia `conversation.status = 'waiting_agent'`
- El widget escucha inserts en `chat_messages` con `sender_type = 'agent'` vía Supabase Realtime

### Lookup de PNR sin tokens

Si el usuario autenticado pregunta por el estado de su reserva, el backend responde **directamente desde la tabla `bookings`** sin llamar al modelo de IA:

```sql
-- El backend busca:
SELECT * FROM bookings WHERE booking_code = 'GST-XXXX' AND profile_id = auth.uid()
```

---

## 📄 Generación de PDF (Vouchers)

**Librería:** `@react-pdf/renderer 4.3.2`

**Contenido del voucher:**
- Encabezado con logo, contacto de la empresa e ID de factura
- Tabla de vuelos de ida (airline, horario, fecha, número de vuelo, ruta, clase, estado)
- Tabla de vuelos de regreso (si aplica)
- Tabla de pasajeros (nombre, equipaje, PNR, número de ticket)
- Políticas / términos (prop configurable)

**Paleta del PDF:** `#0F2545` (encabezado) · `#FF4757` (acento) · `#059669` (estado confirmado)

**Endpoint:** `GET /api/bookings/pdf?booking_id=<uuid>`

---

## 📧 Email (Resend — 10 Templates)

| Template | Cuándo se envía |
|----------|----------------|
| `welcome` | Al completar el registro con OTP |
| `passwordReset` | Al solicitar reseteo de contraseña |
| `bookingConfirmation` | Al confirmar pago (`payment_status → 'paid'`) |
| `emissionComplete` | Al asignar PNR (emisión del boleto) |
| `paymentReceipt` | Recibo transaccional post-pago |
| `bookingCancelled` | Al cancelar una reserva |
| `refund` | Al procesar un reembolso (incluye monto calculado) |
| `reviewRequest` | Post-viaje, solicitando reseña (cron trigger) |
| `agentApproved` | Al aprobar solicitud de alta como agente |
| `agentRejected` | Al rechazar solicitud de alta como agente |

---

## 🗂️ API Endpoints (33 rutas)

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/request-otp` | Enviar OTP al email |
| POST | `/api/auth/verify-otp` | Verificar OTP y retornar session link |
| POST | `/api/auth/complete-register` | Crear contraseña + perfil |
| POST | `/api/auth/validate-credentials` | Verificar email/contraseña (sin crear sesión) |
| POST | `/api/auth/forgot-password` | Iniciar flujo de reseteo de contraseña |

### Vuelos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/flights/search` | Iniciar sesión de búsqueda (2-phase, con caché) |
| GET | `/api/flights/search/[sessionId]` | Obtener estado/resultado de sesión |
| GET | `/api/flights/airports` | Listado completo de aeropuertos |
| GET | `/api/flights/autocomplete?q=` | Autocompletado por IATA o ciudad |
| POST | `/api/flights/persist` | Admin: agregar vuelo al inventario |
| GET/POST | `/api/flights` | CRUD de vuelos |

### Reservas

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/bookings` | Crear reserva con pasajeros |
| GET | `/api/bookings` | Listar reservas del usuario |
| GET | `/api/bookings/pdf` | Generar voucher PDF |
| POST | `/api/bookings/preview` | Preview de detalles antes de pago |
| POST | `/api/bookings/pricing-preview` | Desglose de precio por gateway |

### Pagos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/payments/create-intent` | Crear Stripe PaymentIntent |
| POST | `/api/payments/paypal/create-order` | Crear PayPal Order (v2) |
| POST | `/api/payments/paypal/create-order/capture-order` | Capturar pago PayPal |
| POST | `/api/payments/refund` | Procesar reembolso (Stripe o PayPal) |
| POST | `/api/payments/zelle/request` | Solicitar transferencia Zelle |
| POST | `/api/payments/zelle/confirm` | Admin: confirmar recepción Zelle |
| POST | `/api/payments/zelle/reject` | Admin: rechazar Zelle |

### Webhooks

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/webhooks/stripe` | Handler Stripe (firma verificada, idempotente) |
| POST | `/api/webhooks/paypal` | Handler PayPal (firma verificada, idempotente) |

### Reseñas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/reviews` | Listar reseñas aprobadas (paginado con cursor) |
| POST | `/api/reviews` | Crear reseña (solo bookings completados) |
| POST | `/api/reviews/trigger` | Cron: solicitar reseñas post-viaje |

### Chat IA

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | OpenAI + PNR lookup + rate limit + persistencia |

### Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| PATCH | `/api/admin/reviews` | Aprobar/rechazar reseña (server-side, service role) |
| POST | `/api/admin/settings` | Actualizar configuración global |

### Agente

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/agent/bookings` | Reservas asignadas al agente |

### Utilidades

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/notifications` | Envío de email de prueba |
| POST | `/api/dev/emit-voucher` | Dev: generación manual de voucher |

---

## 🗺️ Rutas de la Aplicación

### Públicas (sin autenticación)

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page (hero + búsqueda + ofertas + reseñas) |
| `/about` | Información de la empresa |
| `/flights` | Formulario de búsqueda de vuelos |
| `/flights/search` | Resultados de búsqueda (multileg) |
| `/flights/[id]` | Detalle de vuelo |
| `/cars` | Catálogo de renta de autos |
| `/cars/[id]` | Detalle de auto |
| `/offers` | Ofertas exclusivas |
| `/offers/[id]` | Detalle de oferta |
| `/reviews` | Muro de reseñas aprobadas |
| `/checkout` | Proceso de pago |
| `/pay` | Pasarela de pago rápida |
| `/login` | Inicio de sesión |
| `/register` | Registro con OTP |
| `/forgot-password` | Recuperar contraseña |
| `/update-password` | Nueva contraseña |
| `/auth/callback` | Callback OAuth / magic link |
| `/legal/privacy` | Política de privacidad |
| `/legal/terms` | Términos de servicio |
| `/legal/contact` | Formulario de contacto |

### Dashboard de Cliente (`/user/dashboard`)

| Ruta | Descripción |
|------|-------------|
| `/user/dashboard` | Home: KPIs, reservas recientes, tarjeta de lealtad |
| `/user/dashboard/bookings` | Mis reservas |
| `/user/dashboard/loyalty` | Puntos de lealtad y nivel |
| `/user/dashboard/reviews` | Mis reseñas |
| `/user/dashboard/settings` | Configuración de perfil |
| `/user/dashboard/become-agent` | Solicitar alta como agente |

### Dashboard de Agente (`/agent/dashboard`)

| Ruta | Descripción |
|------|-------------|
| `/agent/dashboard` | Home: KPIs, cotizador rápido, muro de noticias |
| `/agent/dashboard/bookings` | Reservas asignadas |
| `/agent/dashboard/commissions` | Mis comisiones (pending/approved/paid) |
| `/agent/dashboard/tickets` | Tickets de soporte con conversación threaded |
| `/agent/dashboard/news` | Muro de noticias |
| `/agent/dashboard/settings` | Configuración del agente |

### Dashboard de Admin (`/admin/dashboard`)

| Ruta | Descripción |
|------|-------------|
| `/admin/dashboard` | Resumen general del sistema |
| `/admin/dashboard/emission` | Emisión de boletos con PNR |
| `/admin/dashboard/bookings` | Todas las reservas |
| `/admin/dashboard/flights` | Inventario de vuelos |
| `/admin/dashboard/markup` | Reglas de markup por vuelo/rol |
| `/admin/dashboard/agents` | Gestión de gestores |
| `/admin/dashboard/reviews` | Moderación de reseñas |
| `/admin/dashboard/tickets` | Cola de tickets de soporte |
| `/admin/dashboard/news` | Publicar noticias |
| `/admin/dashboard/cars` | Inventario de autos |
| `/admin/dashboard/cars/new` | Agregar auto |
| `/admin/dashboard/cars/[id]/edit` | Editar auto |
| `/admin/dashboard/offers` | Editor de ofertas especiales |
| `/admin/dashboard/settings` | Configuración global (fees, markups, SLAs) |

---

## 🔒 Control de Acceso por Rol

| Funcionalidad | Cliente | Agente | Admin |
|---------------|---------|--------|-------|
| Buscar vuelos y autos | ✅ | ✅ | ✅ |
| Hacer reservas | ✅ | ✅ | ✅ |
| Ver propias reservas | ✅ | ✅ | ✅ |
| Ver reservas asignadas | ❌ | ✅ | ✅ |
| Ver todas las reservas | ❌ | ❌ | ✅ |
| Escribir reseñas | ✅ | ✅ | ✅ |
| Moderar reseñas | ❌ | ❌ | ✅ |
| Ver puntos de lealtad | ✅ | ✅ | ✅ |
| Ver propias comisiones | ❌ | ✅ | ✅ |
| Aprobar comisiones | ❌ | ❌ | ✅ |
| Leer noticias de agentes | ❌ | ✅ | ✅ |
| Publicar noticias | ❌ | ❌ | ✅ |
| Crear tickets de soporte | ❌ | ✅ | ✅ |
| Gestionar todos los tickets | ❌ | ❌ | ✅ |
| Emitir boletos (PNR) | ❌ | ❌ | ✅ |
| Gestionar inventario de vuelos | ❌ | ❌ | ✅ |
| Gestionar inventario de autos | ❌ | ❌ | ✅ |
| Configurar markup | ❌ | ❌ | ✅ |
| Gestionar agentes | ❌ | ❌ | ✅ |
| Configuración global | ❌ | ❌ | ✅ |

---

## 🔐 Seguridad

| Mecanismo | Detalle |
|-----------|---------|
| **Row Level Security** | Habilitado en las 21 tablas con políticas por rol |
| **pgcrypto AES-256** | Números de pasaporte almacenados como BYTEA encriptado |
| **Webhook signature** | Verificación de firma para Stripe y PayPal |
| **Idempotencia de webhooks** | `ON CONFLICT DO NOTHING` vía `payment_events` table |
| **Zod validation** | Todos los inputs de API y formularios validados |
| **Rate limiting** | Auth, chat y búsqueda de vuelos limitados por IP/usuario |
| **Middleware de rutas** | `/admin`, `/agent`, `/user` protegidos con verificación de rol |
| **Server-side pricing** | El frontend NUNCA calcula montos: siempre el backend |
| **Audit trail** | Tabla `audit_logs` con trigger inmutable en `bookings` |
| **HSTS** | `max-age=63072000; includeSubDomains; preload` |
| **CSP** | Content-Security-Policy configurado en `next.config.mjs` |
| **X-Frame-Options** | `DENY` (protección contra clickjacking) |
| **X-Content-Type-Options** | `nosniff` |
| **Trace IDs** | Header `X-Trace-Id` inyectado por middleware en cada request |
| **TypeScript strict** | `strict: true` en tsconfig.json |

---

## 🧪 Testing

### Tests Unitarios (Vitest)

```bash
npm run test        # Ejecutar en modo watch
npm run test:ui     # Interfaz visual de Vitest
```

**Archivos de test:**

| Archivo | Qué prueba |
|---------|-----------|
| `src/lib/pricing/priceEngine.test.ts` | Motor de precios (aritmética en centavos, multiplicadores) |
| `src/lib/payments/refundCalculator.test.ts` | Cálculo de reembolsos (reglas de 48h, compensación) |
| `src/lib/flights/orchestrator/flightsOrchestrator.test.ts` | Deduplicación y merge de resultados de vuelos |
| `src/app/api/flights/search/route.test.ts` | API de búsqueda de vuelos |

### Tests E2E (Playwright)

```bash
npm run test:e2e    # Ejecutar en headless
npx playwright test --ui  # Interfaz visual
```

**Archivos de test:**

| Archivo | Qué prueba |
|---------|-----------|
| `e2e/home.spec.ts` | Landing page y navegación principal |
| `e2e/search.spec.ts` | Búsqueda de vuelos, filtros, multileg |
| `e2e/example.spec.ts` | Template base |

---

## 📱 Mobile (Capacitor)

La app puede compilarse para iOS y Android con Capacitor:

```bash
# 1. Build web
npm run build

# 2. Sync con plataformas nativas
npx cap sync

# 3. Abrir en IDE nativo
npx cap open ios      # Abre Xcode
npx cap open android  # Abre Android Studio
```

---

## 🎨 Sistema de Diseño

### Paleta de Colores

| Token | Hex | Uso |
|-------|-----|-----|
| `navy` / `brand-900` | `#0F2545` | Texto principal, fondos corporativos, "GLOBAL SOLUTIONS" |
| `coral` / `accent-500` | `#FF4757` | CTAs, botones primarios, palabra "Travel" |
| `brand-500` | `#2f6ba3` | Links, estados intermedios |
| `accent-green` | `#10b981` | Confirmaciones, éxito |
| `accent-red` | `#ef4444` | Alertas, errores, urgencia |
| `accent-yellow` | `#fbbf24` | Estrellas, ofertas, warnings |
| Blanco | `#FFFFFF` | Fondos, espacio negativo |

### Tipografía

- **Headings**: Oswald / Roboto Condensed
- **Script / Travel**: Dancing Script
- **Body**: Open Sans

---

## 📦 Scripts npm

```bash
npm run dev          # Servidor de desarrollo en :3000
npm run build        # Build optimizado de producción
npm run start        # Servidor de producción
npm run lint         # ESLint
npm run type-check   # Verificación de tipos TypeScript
npm run test         # Vitest (unit tests)
npm run test:ui      # Vitest con interfaz visual
npm run test:e2e     # Playwright (E2E tests)
npm run db:generate  # Generar tipos TypeScript desde Supabase
npm run db:migrate   # Push migraciones a Supabase
npm run db:reset     # Reset de base de datos (⚠️ solo desarrollo)
```

---

## 📈 Métricas del Código

| Métrica | Valor |
|---------|-------|
| Líneas TypeScript/TSX | ~22,600 |
| Componentes React | 36+ |
| API Routes | 33 |
| Servicios | 12 |
| Custom Hooks | 7 |
| Migraciones SQL | 18 |
| Tablas en DB | 21 |
| Triggers automáticos | 7 |
| RPCs (funciones DB) | 9 |
| Vistas SQL | 1 |
| Templates de email | 10 |
| Tests unitarios | 4 archivos |
| Tests E2E | 3 archivos |
| Zod schemas | 10+ |

---

## 🚧 Bloqueadores para Producción

1. **API de vuelos externa** — El sistema usa datos seed. Requiere integrar [Duffel](https://duffel.com), [Amadeus](https://developers.amadeus.com) o [KIU](https://www.kiusys.com) para vuelos reales
2. **RPCs de encriptación PII** — `insert_encrypted_passenger` y `get_decrypted_passenger` necesitan implementación completa en DB
3. **Monitoreo y alertas** — Sentry/OpenTelemetry configurados pero no activos en producción
4. **CSP audit** — Revisar Content Security Policy antes de go-live
5. **E2E en CI** — Playwright configurado pero sin pipeline de CI/CD

---

## 📄 Licencia

Proyecto privado — © 2026 Global Solutions Travel. Todos los derechos reservados.
