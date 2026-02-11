Aquí lo tienes correctamente formateado en **Markdown limpio y estructurado**:

---

# ✈️ Global Solutions Travel App

> Plataforma OTA (Online Travel Agency) multiplataforma para reserva de vuelos internacionales y renta de autos, construida con arquitectura escalable y seguridad de nivel empresarial.

![Estado](https://img.shields.io/badge/Estado-Beta%20Privada-orange)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?logo=stripe)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Capacitor](https://img.shields.io/badge/Capacitor-Mobile-1192d4?logo=capacitor)

---

## 📋 Estado del Proyecto

El sistema se encuentra en un **~45% de desarrollo real**, con la infraestructura de backend crítica finalizada y los dashboards operativos.

| Módulo                            | Progreso | Detalles Actuales                                                                         |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| **1. Motor de Vuelos**            | ⚠️ 50%   | Backend completo (Orquestador, Caché, Deduplicación). Falta API externa (Duffel/Amadeus). |
| **2. Infraestructura Financiera** | ⚠️ 40%   | **Stripe completo** (Intents, Webhooks, Idempotencia). PayPal pendiente.                  |
| **3. Seguridad ("Fortress")**     | ⚠️ 60%   | Estructura DB lista, encriptación `pgcrypto` configurada. Falta auditoría completa.       |
| **4. Autenticación**              | ✅ 90%    | Login, Registro, OTP, Roles (Admin/Agent/User) y protección de rutas.                     |
| **5. Gestión de Agentes**         | ⚠️ 35%   | Dashboard UI completo, Sistema de Tickets y Noticias operativo.                           |
| **6. Experiencia de Usuario**     | ⚠️ 30%   | Estructura de Dashboard Cliente. Sistema de Puntos (Loyalty) solo en backend.             |
| **7. Documentos/Notificaciones**  | ✅ 75%    | Emails transaccionales (Resend) y Generación de Vouchers HTML.                            |
| **8. Asistencia IA**              | ❌ 5%     | Solo estructura de base de datos para chat.                                               |

---

## 📐 Arquitectura Técnica

El proyecto sigue principios de **Clean Architecture** con una estricta separación de responsabilidades.

```text
src/
├── app/                    ← Next.js 14 App Router
│   ├── (auth)/             ← Flujos de autenticación (Login, Register, OTP)
│   ├── (dashboard)/        ← Paneles protegidos por Rol (Admin, Agent, User)
│   │   ├── admin/          ← Gestión global, métricas y usuarios
│   │   ├── agent/          ← Panel operativo de ventas y tickets
│   │   └── user/           ← Historial de viajes, perfil y pagos
│   ├── (public)/           ← Landing, Búsqueda de Vuelos, Checkout
│   └── api/                ← Endpoints REST y Webhooks (Stripe)
├── components/
│   ├── features/           ← Componentes de negocio (Flights, Cars, Payments)
│   ├── forms/              ← Formularios validados con Zod (Booking, Search)
│   ├── layout/             ← Estructura visual (Navbar, Sidebar, Footer)
│   └── ui/                 ← Sistema de diseño atómico reutilizable
├── hooks/                  ← Lógica de estado (useAuth, useBooking, useAgentNews)
├── lib/
│   ├── flights/            ← Motor de búsqueda (Orchestrator, Providers)
│   ├── pricing/            ← Motor de precios (Backend Source of Truth)
│   ├── supabase/           ← Cliente y Admin (Service Role)
│   └── email/              ← Templates y configuración de Resend
├── services/               ← Capa de acceso a datos (Repository Pattern)
└── types/                  ← Definiciones TypeScript compartidas (DB + API)
```

---

## 🧠 Principios Clave

* **Source of Truth en Backend:** El Frontend nunca calcula precios finales. El backend orquesta precios, comisiones y fees.
* **TypeScript Estricto:** Cero uso de `any`. Contratos de tipos compartidos entre front y back.
* **Seguridad RLS:** Row Level Security en Supabase garantiza que cada usuario/agente vea solo sus datos.
* **Idempotencia:** Manejo robusto de Webhooks (Stripe) para evitar duplicidad de transacciones.

---

## 🚀 Inicio Rápido

### Prerrequisitos

* Node.js ≥ 18
* Proyecto en Supabase (con extensiones `pgcrypto` activadas)
* Cuenta de Stripe (Test Mode)
* Cuenta de Resend (para emails)

---

### 1️⃣ Clonar e instalar

```bash
git clone https://github.com/tu-usuario/global-solutions-travel.git
cd global-solutions-travel
npm install
```

---

### 2️⃣ Variables de entorno

Crea un archivo `.env.local`:

```env
# Supabase - Base de datos y Auth
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Stripe - Pagos
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend - Emails
RESEND_API_KEY=re_...

# Seguridad
ENCRYPTION_MASTER_KEY=clave-32-bytes-base64...
```

---

### 3️⃣ Base de Datos

Las migraciones se encuentran en `supabase/migrations`.

```bash
supabase db push
```

---

### 4️⃣ Ejecutar en Desarrollo

```bash
npm run dev
```

Abrir:
👉 [http://localhost:3000](http://localhost:3000)

---

## 💳 Flujo de Pagos (Stripe)

El sistema implementa un flujo de pago seguro desacoplado:

1. **Frontend:** Inicia intención de pago (`/pay?booking_id=...`).
2. **Backend (`/api/payments/create-intent`):**

   * Valida la reserva.
   * Calcula el total final usando el Motor de Precios.
   * Genera el `client_secret` de Stripe.
3. **Frontend:** Renderiza Stripe Elements para captura segura de tarjeta.
4. **Stripe Webhook:** Evento `payment_intent.succeeded` actualiza el estado de la reserva a `PAID`.

---

## 🛠 Comandos Útiles

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
npm run db:generate
```

---

## 📱 Mobile (Capacitor)

```bash
npx cap sync
npx cap open android
npx cap open ios
```

---

## 📄 Licencia

© 2026 Global Solutions Travel. Proyecto Privado.
