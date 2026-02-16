# ✈️ Global Solutions Travel

> Ecosistema multiplataforma para reserva de vuelos internacionales y renta de autos con seguridad de nivel bancario.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe)
![PayPal](https://img.shields.io/badge/PayPal-Payments-00457C?logo=paypal)

---

## 📊 Estado del Proyecto

| Módulo | Progreso | Estado |
|--------|----------|--------|
| Motor de Vuelos | 55% | ⚠️ Parcial (falta API externa) |
| Pagos y Precios | 85% | ✅ Stripe + PayPal completos |
| Seguridad Fortress | 60% | ⚠️ Estructura lista, falta PII |
| Autenticación y Roles | 90% | ✅ Prácticamente completo |
| **Gestión de Agentes** | **90%** | **✅ Comisiones + Tickets threaded + Cotizador** |
| **UX Dashboard** | **85%** | **✅ Lealtad 4 niveles + Reseñas + Puntos auto** |
| Documentos/Email | 80% | ✅ PDF + 6 templates Resend |
| Asistencia IA | 80% | ✅ IA real + PNR + handoff realtime |

**Progreso general: ~72%** | Última actualización: Febrero 2026

---

## 📐 Arquitectura

```
src/
├── app/                   ← Next.js 14 App Router
│   ├── (auth)/            ← Login / Register / OTP / Forgot Password
│   ├── (public)/          ← Vuelos, Autos, Ofertas, Checkout, About
│   ├── (dashboard)/
│   │   ├── admin/dashboard/
│   │   │   ├── agents/        ← Gestión de gestores
│   │   │   ├── bookings/      ← Todas las reservas
│   │   │   ├── emission/      ← Emisión de boletos
│   │   │   ├── flights/       ← Vuelos & markup
│   │   │   ├── news/          ← Publicar noticias para agentes
│   │   │   ├── offers/        ← Ofertas visuales
│   │   │   ├── quotations/    ← Cotizaciones
│   │   │   ├── reviews/       ← Moderación de reseñas (+auto puntos)
│   │   │   ├── tickets/       ← Tickets con mensajes threaded
│   │   │   └── settings/      ← Configuración global
│   │   ├── agent/dashboard/
│   │   │   ├── bookings/      ← Reservas asignadas
│   │   │   ├── commissions/   ← 💰 Comisiones (NUEVO M5)
│   │   │   ├── news/          ← Muro de noticias
│   │   │   ├── tickets/       ← Tickets con thread de mensajes
│   │   │   └── settings/      ← Configuración del agente
│   │   └── user/dashboard/
│   │       ├── bookings/      ← Mis reservas
│   │       ├── reviews/       ← Mis reseñas
│   │       ├── loyalty/       ← 🏆 Puntos de lealtad (NUEVO M6)
│   │       └── settings/      ← Configuración de perfil
│   └── api/
│       ├── auth/          ← OTP, complete-register, verify
│       ├── bookings/      ← CRUD + PDF voucher + preview pricing
│       ├── chat/          ← IA (OpenAI) + KB + PNR lookup
│       ├── flights/       ← Search + CRUD
│       ├── payments/
│       │   ├── create-intent/     ← Stripe PaymentIntent
│       │   ├── paypal/
│       │   │   ├── create-order/  ← PayPal Orders v2
│       │   │   └── capture-order/ ← Capture after approval
│       │   └── refund/            ← Dual Stripe + PayPal refunds
│       ├── reviews/trigger/       ← Cron: solicitar reseñas post-viaje
│       ├── webhooks/
│       │   ├── stripe/    ← Idempotent webhook handler
│       │   └── paypal/    ← Signature-verified webhook
│       └── ...
├── components/            ← 36 componentes React
│   ├── ui/                ← Button, Input, Card, Badge, Modal, Skeleton
│   ├── layout/            ← Navbar, Footer, Sidebar (con logout), Header
│   ├── agent/             ← AgentNewsWall
│   ├── forms/             ← FlightSearch, MultiLeg, Login, Register, Booking
│   ├── features/          ← flights, payments, chat, reviews, home
│   ├── checkout/          ← PayPalCheckout, PaymentSelector
│   └── providers/         ← AuthProvider, ToastProvider
├── hooks/                 ← useAuth, useFlightSearch, useBooking, useAgentNews...
├── services/              ← 12 servicios
│   ├── agent.service.ts         ← Dashboard stats + resumen comisiones
│   ├── commission.service.ts    ← 💰 Tracking comisiones (NUEVO)
│   ├── loyalty.service.ts       ← 🏆 Balance, historial, canje (NUEVO)
│   ├── tickets.service.ts       ← Tickets threaded (REESCRITO)
│   ├── bookings.service.ts      ← CRUD reservas
│   ├── reviews.service.ts       ← Reseñas
│   ├── pricing.service.ts       ← Motor de precios
│   ├── payments.service.ts      ← Pagos
│   ├── auth.service.ts          ← Autenticación
│   ├── otp.service.ts           ← One-time passwords
│   ├── flights.service.ts       ← Búsqueda de vuelos
│   └── agentNews.service.ts     ← Noticias de agentes
├── lib/
│   ├── pricing/           ← Motor de precios determinista
│   │   ├── priceEngine.ts       ← Matemáticas puras (centavos)
│   │   ├── passengerRules.ts    ← Clasificación por edad (DOB)
│   │   └── bookingPricing.ts    ← Reglas de negocio (buffer + fees)
│   ├── payments/          ← Refund calculator + engine
│   ├── flights/           ← Orchestrator + providers
│   ├── email/             ← Resend + templates + notifications
│   ├── supabase/          ← Client, server, admin, middleware
│   └── validations/       ← Esquemas Zod
├── types/                 ← TypeScript types + database.types.ts
└── styles/                ← Design tokens

supabase/
├── migrations/            ← 5 migraciones SQL
│   ├── 001_complete_schema.sql
│   ├── 002_extended_schema.sql
│   ├── 002_spec_compliance.sql
│   ├── 003_app_settings.sql
│   ├── 004_payment_events_and_refunds.sql
│   └── 005_modules_5_6_completion.sql   ← NUEVO
└── config.toml
```

### Principios de Diseño

- **Clean Architecture**: UI → Hooks → Services → Supabase
- **TypeScript Estricto**: `strict: true`, sin `any`, parsers seguros
- **Server-Side Source of Truth**: El frontend NUNCA calcula precios
- **Idempotencia**: Webhooks con `ON CONFLICT DO NOTHING` via RPCs
- **Integer Arithmetic**: Todos los cálculos financieros en centavos
- **Automatización por Triggers**: Comisiones, puntos y auditoría vía DB triggers

---

## 💳 Sistema de Pagos (Módulo 2)

### Motor de Precios

```
Base fare × Age multiplier → Subtotal
  + Volatility buffer (3%) → Pre-fee total
  + Gateway fee → Final amount

Age Multipliers:
  Infant (0-2):  10% of base
  Child (2-12):  75% of base
  Adult (12+):  100% of base

Gateway Fees:
  Stripe:  2.9% + $0.30
  PayPal:  3.49% + $0.49
```

### Flujo de Pago

**Stripe:** `create-intent` → Client confirms → `payment_intent.succeeded` webhook → DB update

**PayPal:** `create-order` → User approves → `capture-order` → DB update (webhook as safety net)

### Reembolsos

| Escenario | Reembolso |
|-----------|-----------|
| Cliente < 48h | 100% (menos gateway fee) |
| Cliente > 48h | 50% |
| Cancelación aerolínea | 100% + $20 compensación |

Gateway fees **nunca** se devuelven.

---

## 👥 Gestión de Agentes B2B (Módulo 5)

### Sistema de Comisiones
- **Auto-generación**: DB trigger `auto_generate_commission` crea comisión del 5% cuando booking pasa a `confirmed`
- **Tabla**: `agent_commissions` con estados `pending` → `approved` → `paid`
- **Vista agente**: `/agent/dashboard/commissions` — resumen financiero + tabla detallada por reserva
- **Vista admin**: Aprobación y marcado de pago masivo
- **Dashboard integrado**: Card de comisiones con total ganado y pendiente de aprobación

### Tickets de Soporte (Threaded)
- Conversaciones almacenadas en `agent_ticket_messages` (no campo plano)
- Categorías: general, booking_issue, payment, technical, complaint, suggestion
- Prioridades: low, medium, high, urgent
- Flujo: `open` → `in_progress` → `waiting_response` → `resolved` → `closed`
- Respuesta inline en tiempo real tanto para agente como admin
- Expandir/colapsar threads por ticket

### Cotizador Rápido
- Integrado en dashboard del agente con inputs IATA + fecha
- Redirección directa a `/flights/search` con parámetros
- Etiqueta "MODO AGENTE: NETO" para precios sin markup

### Muro de Noticias
- Admin publica actualizaciones, promociones y alertas
- Noticias fijables (pinned) con categorías coloreadas
- Componente `AgentNewsWall` reutilizable en dashboard

---

## ⭐ Experiencia de Usuario (Módulo 6)

### Programa de Lealtad — 4 Niveles

```
🥉 Bronce    0 – 499 pts
🥈 Plata   500 – 1,999 pts
🥇 Oro   2,000 – 4,999 pts
💎 Platino  5,000+ pts
```

### Obtención Automática de Puntos (DB Triggers)

| Evento | Puntos | Trigger |
|--------|--------|---------|
| Reserva completada | 1 pt por cada $1 gastado | `auto_award_booking_points` |
| Reseña aprobada (texto) | 50 pts | `auto_award_review_points` |
| Reseña aprobada (con fotos) | 100 pts | `auto_award_review_points` |

### Página de Puntos (`/user/dashboard/loyalty`)
- Tarjeta hero con nivel actual, balance y barra de progreso al siguiente nivel
- Historial de transacciones con tipo (reserva, reseña, canje, promo)
- Estadísticas: total ganados, canjeados, número de transacciones
- Guía visual de los 4 niveles
- Sección "¿Cómo ganar puntos?"

### Sistema de Reseñas
- Solo para bookings con status `completed` (compra verificada)
- Calificación 1-5 estrellas + título + comentario + fotos opcionales
- Admin modera en `/admin/dashboard/reviews`: al aprobar, se otorgan puntos automáticamente
- Cron endpoint `POST /api/reviews/trigger`: solicita reseñas post-viaje (return_date + 1 día)

### Dashboard de Usuario
- KPIs en tiempo real: reservas, activas, gasto total, puntos de lealtad
- Tarjeta de nivel con emoji y badge de color
- Reservas recientes con PNR, estado y monto
- Accesos rápidos a reseñas pendientes y programa de puntos

---

## 🗄️ Base de Datos (Supabase)

### Tablas (21)

**Core**: `profiles` · `airlines` · `airports` · `flights` · `bookings` · `booking_passengers`

**Productos**: `car_rentals` · `car_rental_bookings` · `special_offers`

**Agentes**: `agent_news` · `agent_tickets` · `agent_ticket_messages` · `agent_commissions`

**Usuarios**: `reviews` · `loyalty_transactions` · `quotation_requests`

**Sistema**: `chat_conversations` · `chat_messages` · `payment_events` · `app_settings` · `audit_logs` · `chat_rate_limits`

### Triggers Automáticos

| Trigger | Tabla | Acción |
|---------|-------|--------|
| `auto_generate_commission` | bookings | Crea comisión 5% al confirmar reserva |
| `auto_award_review_points` | reviews | Otorga 50/100 pts al aprobar reseña |
| `auto_award_booking_points` | bookings | Otorga 1 pt/$1 al completar reserva |
| `audit_bookings` | bookings | Log inmutable INSERT/UPDATE/DELETE |
| `auto_ticket_code` | agent_tickets | Genera código TK-XXXXXX |
| `handle_new_user` | auth.users | Crea perfil automáticamente |
| `update_*_updated_at` | varias | Actualiza timestamp automáticamente |

### RPCs

| Función | Descripción |
|---------|-------------|
| `add_loyalty_points(...)` | Otorga/deduce puntos + actualiza `profiles.loyalty_points` |
| `encrypt_passport(text)` | Encripta PII con pgcrypto AES |
| `decrypt_passport(bytea)` | Desencripta PII |
| `log_payment_event_once(...)` | Idempotente para webhooks genérico |
| `log_stripe_event_once(...)` | Wrapper Stripe |
| `log_paypal_event_once(...)` | Wrapper PayPal |
| `increment_chat_rate_limit(...)` | Rate limit para chat IA |

### Vista

| Vista | Descripción |
|-------|-------------|
| `agent_commission_summary` | Resumen de comisiones por agente (total, pendiente, pagado) |

### RLS (Row Level Security)

Todas las tablas tienen RLS habilitado con políticas por rol:
- **Clients**: Solo ven sus propios datos (bookings, reviews, loyalty)
- **Agents**: Ven sus bookings asignados, tickets propios, comisiones propias
- **Admins**: Acceso completo a todas las tablas

---

## 🤖 Asistencia IA (Módulo 8)

El módulo de chat incluye:

- **IA real** vía endpoint `POST /api/chat`
- **Persistencia** en `chat_conversations` y `chat_messages` (Supabase)
- **Consulta de estado por PNR** (solo usuarios autenticados; busca por `booking_code` o `airline_pnr`)
- **Escalado a agente** (cambia `status` a `waiting_agent`)
- **Handoff realtime**: el widget escucha inserts en `chat_messages` con `sender_type='agent'`

### Archivos clave

- `src/components/features/chat/ChatWidget.tsx`
- `src/app/api/chat/route.ts`

### Configuración requerida

1) Agrega en `.env.local`:

```bash
OPENAI_API_KEY=tu_key
OPENAI_MODEL=gpt-4o-mini
```

2) En Supabase, habilita Realtime para la tabla `chat_messages` (publication/replication).

### Prueba rápida de handoff a agente

Una vez que exista un `conversation_id`, puedes simular respuesta de agente:

```sql
insert into chat_messages (conversation_id, sender_type, message)
values ('<UUID_CONVERSATION>', 'agent', 'Hola, soy tu agente. ¿En qué te ayudo?');
```

### Troubleshooting: no se crea `chat_conversations`

Si no ves filas en `chat_conversations` / `chat_messages` después de enviar mensajes:

1) **Confirma que estás autenticado** (el chat solo persiste cuando hay `user`).

2) **Verifica Realtime**: en Supabase → Database → Publications → `supabase_realtime` debe mostrar `chat_messages`.

3) **Revisa errores en consola del navegador**: el widget imprime errores reales de Supabase
   (lo más común es **RLS** o **FK**).

4) **Confirma que existe tu perfil** (FK a `profiles(id)`):

```sql
select u.id, u.email, p.id as profile_id
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc
limit 20;
```

Si `profile_id` sale `NULL`, crea los perfiles faltantes:

```sql
insert into public.profiles (id, email, full_name, role, is_active)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name','Usuario'), 'client', true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js ≥ 18
- Cuenta [Supabase](https://supabase.com) (plan pago)
- Cuenta [Stripe](https://stripe.com)
- Cuenta [PayPal Developer](https://developer.paypal.com) (sandbox)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/global-solutions-travel.git
cd global-solutions-travel
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (server-only) |
| `ENCRYPTION_MASTER_KEY` | Clave AES-256 de 64+ caracteres |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Client ID de PayPal |
| `PAYPAL_CLIENT_ID` | Client ID de PayPal (server) |
| `PAYPAL_CLIENT_SECRET` | Client Secret de PayPal |
| `PAYPAL_WEBHOOK_ID` | ID del webhook configurado en PayPal |
| `PAYPAL_ENV` | `sandbox` o `live` |
| `RESEND_API_KEY` | API key de Resend para emails |
| `OPENAI_API_KEY` | API key de OpenAI (server-only) |
| `OPENAI_MODEL` | Modelo de chat (ej: `gpt-4o-mini`) |

### 3. Base de datos

Ejecuta las migraciones en orden en el SQL Editor de Supabase:

1. `supabase/migrations/001_complete_schema.sql` — Schema principal + RLS + seed data
2. `supabase/migrations/002_extended_schema.sql` — Extensiones (offers, tickets, chat, loyalty)
3. `supabase/migrations/002_spec_compliance.sql` — Compliance
4. `supabase/migrations/003_app_settings.sql` — Settings de negocio
5. `supabase/migrations/004_payment_events_and_refunds.sql` — Pagos, webhooks, refunds
6. `supabase/migrations/005_modules_5_6_completion.sql` — **Comisiones, triggers de lealtad, auto-puntos**

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 🗂️ API Endpoints

### Chat / IA
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | Chat IA (OpenAI) + KB + lookup PNR + guardado en DB |

### Vuelos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/flights/search` | Búsqueda con filtros y caché |
| GET/POST | `/api/flights` | CRUD de vuelos |

### Pagos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/payments/create-intent` | Crear Stripe PaymentIntent |
| POST | `/api/payments/paypal/create-order` | Crear PayPal Order v2 |
| POST | `/api/payments/paypal/capture-order` | Capturar pago PayPal |
| POST | `/api/payments/refund` | Reembolso dual (Admin/Agent) |
| POST | `/api/bookings/preview` | Preview de precio por gateway |

### Webhooks
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhook (idempotente) |
| POST | `/api/webhooks/paypal` | PayPal webhook (firma verificada) |

### Bookings & Reviews
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/bookings` | Crear reserva |
| GET | `/api/bookings/pdf` | Generar voucher PDF |
| POST | `/api/reviews/trigger` | Cron: solicitar reseñas post-viaje |

---

## 🗺️ Rutas de la Aplicación

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing page |
| `/flights` | Público | Búsqueda de vuelos |
| `/flights/search` | Público | Resultados de búsqueda |
| `/flights/[id]` | Público | Detalle de vuelo |
| `/cars` | Público | Renta de autos |
| `/offers` | Público | Ofertas exclusivas |
| `/checkout` | Auth | Proceso de pago (Stripe/PayPal) |
| `/login` | Público | Inicio de sesión |
| `/register` | Público | Registro |
| `/user/dashboard` | Cliente | Dashboard del cliente |
| `/user/dashboard/bookings` | Cliente | Mis reservas |
| `/user/dashboard/reviews` | Cliente | Mis reseñas |
| `/user/dashboard/loyalty` | Cliente | 🏆 Puntos de lealtad |
| `/user/dashboard/settings` | Cliente | Configuración |
| `/agent/dashboard` | Agente | Dashboard del agente (cotizador + comisiones) |
| `/agent/dashboard/bookings` | Agente | Reservas asignadas |
| `/agent/dashboard/commissions` | Agente | 💰 Mis comisiones |
| `/agent/dashboard/tickets` | Agente | Tickets de soporte (threaded) |
| `/agent/dashboard/news` | Agente | Muro de noticias |
| `/agent/dashboard/settings` | Agente | Configuración |
| `/admin/dashboard` | Admin | Panel de administración |
| `/admin/dashboard/emission` | Admin | Emisión de boletos |
| `/admin/dashboard/bookings` | Admin | Todas las reservas |
| `/admin/dashboard/flights` | Admin | Vuelos & markup |
| `/admin/dashboard/agents` | Admin | Gestión de gestores |
| `/admin/dashboard/reviews` | Admin | Moderación de reseñas |
| `/admin/dashboard/tickets` | Admin | Tickets de soporte |
| `/admin/dashboard/news` | Admin | Publicar noticias |
| `/admin/dashboard/settings` | Admin | Configuración global |

---

## 🔐 Seguridad

- **Row Level Security (RLS)** en todas las tablas (21 tablas)
- **pgcrypto** activado para encriptación AES-256 de PII
- **Webhook signature verification** para Stripe y PayPal
- **Idempotencia** en webhooks via RPCs con `ON CONFLICT`
- **Zod validation** en todos los endpoints y formularios
- **Rate limiting** en búsquedas (5/30s), login y chat IA
- **Middleware** protege rutas `/admin`, `/agent`, `/user`
- **Server-side pricing** — frontend nunca calcula montos
- **Audit trail** — tabla `audit_logs` con trigger inmutable en bookings

---

## 🎨 Sistema de Diseño (Identidad Visual Oficial)

| Token | Valor | Uso |
|---|---|---|
| `navy` / `brand-900` | `#0F2545` | Texto principal, fondos corporativos, "GLOBAL SOLUTIONS" |
| `coral` / `accent-500` | `#FF4757` | CTAs, botones primarios, palabra "Travel" |
| Blanco | `#FFFFFF` | Fondos, espacio negativo |
| `brand-500` | `#2f6ba3` | Links, estados intermedios |
| `accent-green` | `#10b981` | Confirmaciones, éxito |
| `accent-red` | `#ef4444` | Alertas, urgencia |
| `accent-yellow` | `#fbbf24` | Ofertas, estrellas, warnings |

**Tipografía**: Oswald / Roboto Condensed (headings) · Dancing Script (script/Travel) · Open Sans (body).

---

## 📦 Scripts

```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # ESLint
npm run type-check   # Verificación de tipos
npm run db:generate  # Generar tipos TypeScript desde Supabase
npm run db:migrate   # Push migrations
npm run db:reset     # Reset database
```

---

## 📈 Métricas del Código

| Métrica | Valor |
|---------|-------|
| Líneas TypeScript/TSX | ~22,600 |
| Componentes React | 36 |
| API Routes | 22 |
| Services | 12 |
| Custom Hooks | 6 |
| SQL Migrations | 5 (+1 compliance) |
| DB Tables | 21 |
| DB Triggers | 7 automáticos |
| Zod Schemas | 3 |
| Email Templates | 6 |
| Unit Tests | 1 (priceEngine) |

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Framework | Next.js 14.2.15 (App Router) |
| Lenguaje | TypeScript 5.6 (strict mode) |
| UI | React 18.3 + Tailwind CSS 3.4 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Pagos | Stripe 16.12 + PayPal REST v2 |
| Email | Resend 6.9 |
| IA Chat | OpenAI API (gpt-4o-mini) |
| Validación | Zod 3.23 |
| Iconos | Lucide React |
| Toasts | Sonner |
| Móvil | Capacitor 8.0 (iOS/Android) |

---

## 🔜 Bloqueadores Críticos para Producción

1. **API de vuelos externa** — Integrar Duffel/Amadeus/KIU para reemplazar datos seed
2. **RPCs de encriptación PII** — `insert_encrypted_passenger` / `get_decrypted_passenger`
3. **Headers CSP** — Content Security Policy + audit_logs append-only

---

## 📄 Licencia

Proyecto privado — © 2026 Global Solutions Travel.

---

## 🤖 Módulo IA (Chat de Soporte)

### Variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto:

```env
OPENAI_API_KEY=TU_KEY
OPENAI_MODEL=gpt-5.2-chat-latest
```

> Si no tienes crédito en OpenAI, el endpoint devuelve un **fallback** (no rompe la app).

### Control de gasto (anti-spam / $20 al mes)

Este proyecto aplica 4 medidas para reducir tokens:

1. **Filtro in-scope**: si el mensaje no es sobre la agencia (vuelos, reservas, pagos, etc.), NO llama al modelo.
2. **Rate limit diario**: limita mensajes por día (usuario logueado / invitado por IP).
3. **Historial corto**: solo envía los últimos 6 mensajes al modelo.
4. **Respuestas cortas**: prompt + `max_tokens` limitan la salida.

#### Paso requerido en Supabase: RPC para rate limit

> El servidor usa Supabase con **anon key** (RLS aplica). Para que el rate limit funcione sin abrir políticas,
> se recomienda esta función `security definer`.

Ejecuta en **SQL Editor**:

```sql
create table if not exists public.chat_rate_limits (
  key text primary key,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.chat_rate_limits enable row level security;

create or replace function public.increment_chat_rate_limit(p_key text, p_limit int)
returns table(allowed boolean, count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_rate_limits(key, count, updated_at)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = public.chat_rate_limits.count + 1,
        updated_at = now();

  select (public.chat_rate_limits.count <= p_limit), public.chat_rate_limits.count
    into allowed, count
  from public.chat_rate_limits
  where key = p_key;

  return;
end;
$$;

revoke all on function public.increment_chat_rate_limit(text, int) from public;
grant execute on function public.increment_chat_rate_limit(text, int) to anon, authenticated;
```

### Respuestas operativas de reservas (sin gastar tokens)

Si el usuario está logueado y pregunta por su reserva (PNR / código `GST-XXXX` / "estado de mi reserva"),
el backend intenta responder **directamente desde la tabla `bookings`** antes de llamar a la IA.

Esto permite:
- Responder estado de pago / emisión / voucher
- Indicar siguiente paso (pago, esperar emisión, escalar a agente)
- Reducir costo de tokens
