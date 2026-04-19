# Biblioteca Escuela — PWA de control de acceso

PWA offline-first para registrar entradas y salidas de estudiantes a la biblioteca escolar, con encuestas de satisfacción y panel administrativo con reportes.

Stack: **Next.js 16 · React 19 · Prisma 7 · Supabase Postgres · Serwist (PWA) · Tailwind v4 · IndexedDB**.

---

## Características

- **Registro offline** de entradas/salidas en IndexedDB; se sincronizan al backend cuando hay red (Background Sync API).
- **Encuesta opcional** al salir, máximo una vez cada 30 días por dispositivo.
- **Panel admin** protegido con JWT (cookie httpOnly) y Bcrypt, con dashboard, reportes filtrables y exportación a Excel/PDF.
- **Cron diario de auto-cierre** (`/api/cron/auto-close`) que cierra sesiones olvidadas estimando duración con el promedio de las últimas visitas del estudiante.
- **QR de instalación** generable desde el panel para imprimir y pegar en la entrada.

---

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno y rellenar
cp .env.example .env

# 3. Aplicar migraciones y crear el admin inicial
npx prisma migrate deploy
npx prisma db seed   # crea admin@biblioteca.edu / admin123

# 4. Levantar dev server
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> **Importante:** cambia la contraseña del admin (`/admin/cuenta`) antes de exponer la app.

---

## Variables de entorno

Ver [`.env.example`](./.env.example). Resumen:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión Postgres con pooling (puerto 6543, runtime). |
| `DIRECT_URL` | Conexión directa (puerto 5432, migraciones). |
| `JWT_SECRET` | Firma del token de sesión admin. |
| `CRON_SECRET` | Autoriza al cron de Vercel (`Bearer`). |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (opcional hoy). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública Supabase (opcional hoy). |

---

## Estructura

```
app/
  page.tsx              -> Router que despacha a /registro, /entrada o /salida
  registro/             -> Alta del estudiante (datos persistentes en IndexedDB)
  entrada/, salida/     -> Botones grandes de check-in/check-out
  encuesta/             -> Encuesta de satisfacción
  admin/(protected)/    -> Dashboard, reportes, cuenta y QR (requiere login)
  api/
    sync/               -> Endpoint de sincronización IndexedDB <-> Postgres
    auth/               -> login / logout / change-password / me
    dashboard/, reports/, export/ -> Datos para el panel
    cron/auto-close/    -> Cron diario protegido por CRON_SECRET
  sw.ts, serwist.ts     -> Service worker (Serwist)
components/             -> UI compartida (admin shell, header, botones, etc.)
lib/
  idb.ts                -> Cliente IndexedDB (estudiante, registros, encuestas, sync)
  prisma.ts             -> Cliente Prisma con adaptador Pg
  auth.ts               -> JWT con jose + cookie de sesión
  constants.ts          -> Carreras, semestres, hora de cierre
prisma/
  schema.prisma         -> Modelo (Student, AccessRecord, SurveyResponse, AdminUser)
  migrations/           -> Migraciones SQL
  seed.ts               -> Crea admin inicial
```

---

## Despliegue

Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) para la guía paso a paso de Vercel + Supabase.

---

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Build de producción (Vercel ejecuta `prisma migrate deploy && next build`). |
| `npm start` | Servir el build. |
| `npm run lint` | ESLint. |
