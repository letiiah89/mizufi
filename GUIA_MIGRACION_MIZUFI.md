# MiZUFi — código fuente completo

Esta copia contiene el código fuente de MiZUFi correspondiente a la versión publicada el **28 de septiembre de 2026**.

No contiene datos de usuarios, contraseñas, claves privadas, secretos de producción, la base de datos desplegada ni `node_modules`. Esos elementos no forman parte del código fuente y deben configurarse de nuevo en el destino.

## 1. Qué incluye

- `app/`: interfaz React, estilos, autenticación, lógica financiera y rutas API/backend.
- `worker/`: punto de entrada del Cloudflare Worker.
- `db/`: conexión y esquema de base de datos.
- `drizzle/`: migraciones SQL e historial de Drizzle.
- `public/`: PWA, iconos, logos, service worker y pantalla sin conexión.
- `scripts/`: instalación y compilación verificadas para el alojamiento actual.
- `tests/`: pruebas automatizadas.
- `build/`: integración de compilación con Sites/Vite.
- `package.json` y `package-lock.json`: dependencias y versiones bloqueadas.
- Archivos de configuración de TypeScript, Vite, Vinext/Next, Tailwind, ESLint, Drizzle y Sites.

`ESTRUCTURA_COMPLETA.txt` enumera todos los archivos del ZIP.

## 2. Tecnología y requisitos

- Node.js **22.13.0 o posterior**.
- npm, incluido con Node.js.
- React 19, Vinext/Vite, TypeScript y Cloudflare Workers.
- Base de datos compatible con Cloudflare D1/SQLite.
- Supabase para autenticación de usuarios.

Para la instalación estándar en cualquier sistema:

```bash
npm ci
```

En Linux también se puede usar el instalador verificado del proyecto:

```bash
npm run install:ci
```

## 3. Variables de entorno

Copia `.env.example` como `.env.local` o configura estas variables en el proveedor de alojamiento. El ZIP solo contiene nombres y valores de ejemplo, nunca las claves reales.

| Variable | Uso | Secreta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Eliminación administrativa de usuarios | Sí |
| `SUPERBASE_SERVICE_ROLE_KEY` | Alias legado admitido por compatibilidad | Sí |
| `STRIPE_SECRET_KEY` | Crear pagos VIP | Sí |
| `STRIPE_WEBHOOK_SECRET` | Validar notificaciones de Stripe | Sí |
| `STRIPE_PRICE_ID` | Identificador del precio VIP | No, pero depende de la cuenta |
| `RESEND_API_KEY` | Enviar avisos de errores y sugerencias | Sí |

No publiques las variables secretas ni las incluyas en el repositorio.

## 4. Conexiones externas

MiZUFi utiliza:

- **Supabase Auth**: registro, acceso, verificación, recuperación de contraseña y eliminación de usuarios.
- **Cloudflare D1**: datos financieros, espacios, membresías, preferencias y mensajes de la beta. El binding esperado se llama `DB`.
- **Stripe**: pago único VIP y webhook de confirmación.
- **Resend**: envío por correo de errores y sugerencias a MiZUFi.
- **Sites/Cloudflare Worker**: alojamiento actual, recursos estáticos y optimización de imágenes.

Al trasladarlo, hay que crear o conectar servicios equivalentes. El ZIP no exporta las cuentas externas ni los datos que ya existen dentro de ellas.

## 5. Base de datos

El esquema está en `db/schema.ts` y las migraciones SQL están en `drizzle/`.

En el alojamiento actual, `.openai/hosting.json` declara el binding D1 con el nombre `DB`. En otro proveedor se debe crear una base SQLite/D1, aplicar en orden las migraciones `drizzle/0000_*.sql` a `drizzle/0006_*.sql` y exponerla a la aplicación con ese binding, o adaptar `db/index.ts` y `app/finance-store.ts` al sistema de base de datos elegido.

Para generar una nueva migración después de modificar el esquema:

```bash
npm run db:generate
```

## 6. Ejecutar en desarrollo

1. Instala Node.js 22.13 o posterior.
2. Ejecuta `npm ci`.
3. Crea `.env.local` a partir de `.env.example` y añade tus propias credenciales.
4. Configura una base D1 local o equivalente con el binding `DB`.
5. Inicia el proyecto:

```bash
npm run dev
```

Vite utiliza normalmente el puerto **5173**. Para fijar otro puerto:

```bash
npm run dev -- --port 3000
```

## 7. Compilar y ejecutar la versión de producción

```bash
npm run build
npm run start
```

El artefacto compilado se crea en `dist/`. El servidor de producción suele usar el puerto **3000**; si el proveedor lo requiere, debe respetarse su variable `PORT` o la configuración equivalente.

Comandos adicionales:

```bash
npm test
npm run lint
```

## 8. Rutas backend incluidas

- `/api/finance`: lectura y guardado de datos financieros.
- `/api/session`: sesión y preferencias asociadas.
- `/api/spaces`: espacios financieros y miembros.
- `/api/feedback`: errores y sugerencias, con envío opcional por Resend.
- `/api/vip/checkout`: inicio del pago VIP.
- `/api/stripe/webhook`: confirmación de pagos de Stripe.
- `/api/monetization-events`: eventos de monetización.

## 9. Qué no contiene el ZIP

- Claves o contraseñas reales.
- Archivos `.env` de producción.
- Usuarios de Supabase.
- Datos financieros almacenados en producción.
- Historial de pagos de Stripe.
- `node_modules`, cachés, logs, compilaciones antiguas o historial `.git`.

Si necesitas trasladar también los datos actuales, hay que exportarlos por separado desde Supabase, Cloudflare D1 y Stripe, respetando privacidad y protección de datos.

## 10. Recomendación para otro programa

Entrega el ZIP completo y esta guía. Indica que debe preservar la estructura, ejecutar `npm ci` y no sustituir la lógica financiera sin revisar primero `app/finance.tsx`, `app/finance-store.ts`, `app/budgets.tsx`, `app/annual-expenses.tsx` y `app/debts.tsx`.
