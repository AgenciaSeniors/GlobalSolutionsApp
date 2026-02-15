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
| Gestión de Agentes | 45% | ⚠️ UI + servicios básicos |
| UX Dashboard | 35% | ⚠️ DB lista, falta conexión UI |
| Documentos/Email | 80% | ✅ PDF + 6 templates Resend |
| Asistencia IA | 80% | ✅ IA real + PNR + handoff realtime |

**Progreso general: ~58%** | Última actualización: Febrero 2026

---

## 📐 Arquitectura

```
src/
├── app/                   ← Next.js 14 App Router
│   ├── (auth)/            ← Login / Register / OTP / Forgot Password
│   ├── (public)/          ← Vuelos, Autos, Ofertas, Checkout, About
│   ├── (dashboard)/       ← Admin / Agent / User dashboards
│   └── api/
│       ├── auth/          ← OTP, complete-register, verify
│       ├── bookings/      ← CRUD + PDF voucher + preview pricing
│       ├── flights/       ← Search + CRUD
│       ├── payments/
│       │   ├── create-intent/     ← Stripe PaymentIntent
│       │   ├── paypal/
│       │   │   ├── create-order/  ← PayPal Orders v2
│       │   │   └── capture-order/ ← Capture after approval
│       │   └── refund/            ← Dual Stripe + PayPal refunds
│       ├── webhooks/
│       │   ├── stripe/    ← Idempotent webhook handler
│       │   └── paypal/    ← Signature-verified webhook
│       └── ...
├── components/            ← 35 componentes React
│   ├── ui/                ← Button, Input, Card, Badge, Modal, Skeleton
│   ├── layout/            ← Navbar, Footer, Sidebar, Header
│   ├── forms/             ← FlightSearch, MultiLeg, Login, Register, Booking
│   ├── features/          ← flights, payments, chat, reviews, home
│   ├── checkout/          ← PayPalCheckout, PaymentSelector
│   └── providers/         ← AuthProvider, ToastProvider
├── hooks/                 ← useAuth, useFlightSearch, useBooking, useAgentNews...
├── services/              ← 10 servicios (pricing, payments, bookings, auth...)
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
├── migrations/            ← 4 migraciones SQL (schema + RLS + payments)
└── config.toml
```

### Principios de Diseño

- **Clean Architecture**: UI → Hooks → Services → Supabase
- **TypeScript Estricto**: `strict: true`, sin `any`, parsers seguros
- **Server-Side Source of Truth**: El frontend NUNCA calcula precios
- **Idempotencia**: Webhooks con `ON CONFLICT DO NOTHING` via RPCs
- **Integer Arithmetic**: Todos los cálculos financieros en centavos

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

1. `supabase/migrations/001_complete_schema.sql` — Schema principal
2. `supabase/migrations/002_extended_schema.sql` — Extensiones
3. `supabase/migrations/002_spec_compliance.sql` — Compliance
4. `supabase/migrations/003_app_settings.sql` — Settings
5. `supabase/migrations/004_payment_events_and_refunds.sql` — Pagos y reembolsos

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

### Bookings
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/bookings` | Crear reserva |
| GET | `/api/bookings/pdf` | Generar voucher PDF |

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
| `/agent/dashboard` | Agente | Dashboard del agente |
| `/admin/dashboard` | Admin | Panel de administración |

---

## 🔐 Seguridad

- **Row Level Security (RLS)** en todas las tablas
- **pgcrypto** activado para encriptación AES-256 de PII
- **Webhook signature verification** para Stripe y PayPal
- **Idempotencia** en webhooks via RPCs con `ON CONFLICT`
- **Zod validation** en todos los endpoints y formularios
- **Rate limiting** en búsquedas (5/30s) y login
- **Middleware** protege rutas `/admin`, `/agent`, `/user`
- **Server-side pricing** — frontend nunca calcula montos

---

## 🎨 Sistema de Diseño

| Token | Valor | Uso |
|---|---|---|
| `brand-500` | `#3b82f6` | Botones primarios |
| `brand-600` | `#2563eb` | Hover, enlaces |
| `brand-900` | `#1e3a8a` | Navbar, footer, headings |
| `accent-yellow` | `#fbbf24` | Ofertas, estrellas |
| `accent-green` | `#10b981` | Confirmaciones |
| `accent-red` | `#ef4444` | Alertas, urgencia |

Tipografía: **DM Sans** (body) + **Playfair Display** (headings).

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

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Framework | Next.js 14.2.15 (App Router) |
| Lenguaje | TypeScript 5.6 (strict mode) |
| UI | React 18.3 + Tailwind CSS 3.4 |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Pagos | Stripe 16.12 + PayPal REST v2 |
| Email | Resend 6.9 |
| Validación | Zod 3.23 |
| Iconos | Lucide React |
| Toasts | Sonner |
| Móvil | Capacitor 8.0 (iOS/Android) |

---

## 📄 Licencia

Proyecto privado — © 2026 Global Solutions Travel.