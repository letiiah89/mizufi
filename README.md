# MiZuFi — Marea · Finanzas con calma

Una app de finanzas personales construida para controlar gastos, presupuestos, deudas y metas de ahorro con claridad y sin complicaciones.

**Versión:** 0.1.0 (Beta)  
**Plataforma:** Cloudflare Workers + Next.js 16 + React 19

---

## Características

- **Cuentas múltiples:** corriente, ahorro, hucha, deudas, inversión
- **Movimientos:** gastos, ingresos, traspasos, devoluciones
- **Presupuestos:** categorías, subcategorías, límites mensuales
- **Deudas:** seguimiento, cuotas, amortización
- **Gastos anuales:** planificación de gasto periódico
- **Espacios compartidos:** personal, demo, compartido con roles
- **PWA:** funciona offline
- **Autenticación:** Supabase Auth (correo + contraseña)
- **Pagos:** Stripe (VIP)
- **Notificaciones:** Resend (email)

---

## Stack técnico

- **Frontend:** React 19, TypeScript, CSS custom
- **Backend:** Next.js API Routes, Node.js
- **Hosting:** Cloudflare Workers (Vinext)
- **BD:** Cloudflare D1 (SQLite) + Drizzle ORM
- **Auth:** Supabase
- **Pagos:** Stripe
- **Email:** Resend
- **Build:** Vite + Wrangler

---

## Requisitos

- Node.js **22.13.0 o posterior**
- npm (incluido con Node.js)
- Cuenta de Supabase (auth)
- Cuenta de Cloudflare (D1, Workers)
- (Opcional) Stripe + Resend

---

## Instalación

### 1. Clonar y instalar

```bash
git clone https://github.com/letiiah89/mizufi.git
cd mizufi
npm ci
```

### 2. Configurar variables de entorno

Copia `.env.example` como `.env.local`:

```bash
cp .env.example .env.local
```

Rellena con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
STRIPE_SECRET_KEY=sk_test_your_key
RESEND_API_KEY=re_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_ID=price_your_price
```

### 3. Base de datos

Si usas Cloudflare D1 local:

```bash
npm run db:generate  # Genera migraciones
```

Aplica migraciones del fichero `drizzle/` al binding `DB`.

---

## Desarrollo

### Iniciar servidor

```bash
npm run dev
```

Accede a `http://localhost:5173`

### Build para producción

```bash
npm run build
npm run start
```

### Lint y tests

```bash
npm run lint
npm test
```

---

## Estructura

```
app/
  ├── finance.tsx           # Componente principal (gran)
  ├── budgets.tsx           # Presupuestos
  ├── debts.tsx             # Deudas
  ├── annual-expenses.tsx   # Gastos anuales
  ├── auth-gate.tsx         # Autenticación
  ├── api/                  # Rutas API
  │   ├── finance/          # CRUD financiero
  │   ├── session/          # Sesión y preferencias
  │   ├── spaces/           # Espacios
  │   ├── vip/checkout/     # Checkout VIP (Stripe)
  │   └── stripe/webhook/   # Webhook de Stripe
  └── [más componentes]
db/
  ├── index.ts              # Conexión D1
  └── schema.ts             # Esquema Drizzle
drizzle/
  ├── 0000_*.sql            # Migraciones
  └── meta/
```

---

## API

### Autenticación
- POST `/auth/signup` — Registrar
- POST `/auth/login` — Iniciar sesión
- POST `/auth/logout` — Cerrar sesión

### Finanzas
- GET `/api/finance` — Obtener datos (cuentas, movimientos, presupuestos)
- POST `/api/finance` — Guardar datos

### Sesión
- GET `/api/session` — Obtener preferencias
- POST `/api/session` — Actualizar preferencias

### Espacios
- GET `/api/spaces` — Espacios del usuario
- POST `/api/spaces` — Crear espacio

### VIP
- POST `/api/vip/checkout` — Crear sesión de checkout
- POST `/api/stripe/webhook` — Webhook de confirmación

---

## Notas

- **Datos personales:** Se guardan en D1, no se sincronizan automáticamente. Usa el backup manual en Drive.
- **Logging:** Desactiva logging en Supabase si usas Free Plan (evita costos).
- **Componentes grandes:** `finance.tsx` (333KB) necesita refactor a componentes más pequeños.
- **Código de ChatGPT:** Migrado de ChatGPT a GitHub para control de versiones.

---

## Desarrollo futuro

- [ ] Refactorizar `finance.tsx` en componentes más pequeños
- [ ] Mejorar tests (actualmente mínimos)
- [ ] Sincronización de datos en tiempo real (Realtime)
- [ ] Gráficas y reportes
- [ ] Exportar datos (CSV, PDF)
- [ ] Modo oscuro mejorado
- [ ] App móvil nativa

---

## Licencia

Privado. Código de MiZuFi.

---

**Última actualización:** 2026-09-28  
**Mantenedor:** Leticia Aparicio
