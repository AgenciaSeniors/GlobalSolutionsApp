# ✈️ Global Solutions Travel

> Ecosistema multiplataforma para reserva de vuelos internacionales y renta de autos con seguridad de nivel bancario.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe)

---

## 📐 Arquitectura

```
src/
├── app/               ← Next.js 14 App Router (páginas y API routes)
│   ├── (auth)/        ← Login / Register (grupo de rutas)
│   ├── (public)/      ← Vuelos, Autos, Ofertas, About
│   ├── (dashboard)/   ← Admin / Agent / User dashboards
│   └── api/           ← REST endpoints + Stripe webhooks
├── components/        ← Componentes React organizados por responsabilidad
│   ├── ui/            ← Atómicos: Button, Input, Card, Badge, Modal, Skeleton
│   ├── layout/        ← Navbar, Footer, Sidebar, Header
│   ├── forms/         ← FlightSearch, Login, Register, Booking
│   ├── features/      ← Agrupados por dominio (flights, cars, reviews, home)
│   └── providers/     ← AuthProvider, ToastProvider
├── hooks/             ← Custom hooks (useAuth, useFlightSearch, useBooking)
├── services/          ← Capa de servicios (Supabase queries)
├── lib/               ← Utilidades, cliente Supabase, validaciones Zod, constantes
├── types/             ← Modelos TypeScript y tipos de API
└── styles/            ← Design tokens / tema

supabase/
├── migrations/        ← SQL completo: tablas, RLS, triggers, seeds
└── config.toml
```

### Principios
- **Clean Architecture**: UI → Hooks → Services → Supabase
- **TypeScript Estricto**: `strict: true`, sin `any`
- **Separación de Responsabilidades**: Un archivo = una responsabilidad
- **SOLID**: Componentes atómicos reutilizables, servicios desacoplados
- **Seguridad (Protocolo "Fortress")**: RLS en todas las tablas, AES-256 para PII, CSP headers

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js ≥ 18
- Una cuenta en [Supabase](https://supabase.com)
- Una cuenta en [Stripe](https://stripe.com) (para pagos)

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

Abre `.env.local` y completa:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (server-only) |
| `ENCRYPTION_MASTER_KEY` | Clave AES-256 de 64+ caracteres |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de Stripe |

### 3. Base de datos

Ejecuta la migración SQL en tu proyecto Supabase:

1. Ve a **SQL Editor** en el dashboard de Supabase
2. Pega el contenido de `supabase/migrations/001_complete_schema.sql`
3. Ejecuta

Esto crea todas las tablas, índices, RLS policies, triggers y datos semilla.

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 🗂️ Rutas de la Aplicación

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | Público | Landing page |
| `/flights` | Público | Búsqueda de vuelos |
| `/flights/search` | Público | Resultados de búsqueda |
| `/cars` | Público | Renta de autos |
| `/offers` | Público | Ofertas exclusivas |
| `/about` | Público | Sobre nosotros |
| `/login` | Público | Inicio de sesión |
| `/register` | Público | Registro |
| `/user/dashboard` | Cliente | Dashboard del cliente |
| `/agent/dashboard` | Gestor | Dashboard del gestor |
| `/admin/dashboard` | Admin | Panel de administración |

---

## 🔐 Seguridad

- **Row Level Security (RLS)** en todas las tablas
- **pgcrypto AES-256** para datos de pasaportes
- **CSP Headers** en `next.config.ts`
- **Stripe Webhook Signature Verification**
- **Zod validation** en todos los formularios
- **Middleware** protege rutas `/admin`, `/agent`, `/user`

---

## 🎨 Sistema de Diseño

| Token | Valor | Uso |
|---|---|---|
| `brand-500` | `#3b82f6` | Botones primarios |
| `brand-600` | `#2563eb` | Hover, enlaces |
| `brand-900` | `#1e3a8a` | Navbar, footer, textos headings |
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
```

---

## 📄 Licencia

Proyecto privado — © 2026 Global Solutions Travel.
