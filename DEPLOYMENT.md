# Deployment a Vercel

Guía paso a paso para desplegar la PWA de la Biblioteca Escolar en Vercel con base de datos en Supabase.

---

## 1. Pre-requisitos

- Proyecto de **Supabase** creado con las migraciones ya aplicadas (`npx prisma migrate deploy` corrido localmente al menos una vez).
- Repositorio en **GitHub / GitLab / Bitbucket** con este código.
- Cuenta en **Vercel** conectada al repo.

---

## 2. Variables de entorno

En el dashboard de Vercel: **Project → Settings → Environment Variables**.
Copia las cinco variables abajo. Usa los mismos valores en los tres entornos (`Production`, `Preview`, `Development`) salvo que indique lo contrario.

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | Pooler, puerto 6543. Usado en runtime. |
| `DIRECT_URL` | `postgresql://postgres.<ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres` | Conexión directa, puerto 5432. Solo se usa durante `prisma migrate deploy` en el build. |
| `JWT_SECRET` | *(48 bytes aleatorios, base64url)* | Ver "Generar secretos" más abajo. **No uses el mismo de tu `.env` local.** |
| `CRON_SECRET` | *(48 bytes aleatorios, base64url)* | Igual que arriba. Vercel enviará este valor automáticamente como `Authorization: Bearer <CRON_SECRET>` a `/api/cron/auto-close`. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Opcional hoy (no se usa en el código), pero evita warnings. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Opcional. |

### Generar secretos

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Córrelo dos veces (uno para `JWT_SECRET`, otro para `CRON_SECRET`).

---

## 3. Build command

El archivo [`vercel.json`](./vercel.json) ya define:

```json
{
  "buildCommand": "prisma migrate deploy && next build",
  "crons": [
    { "path": "/api/cron/auto-close", "schedule": "5 0 * * *" }
  ]
}
```

- Esto aplica automáticamente las migraciones pendientes antes de cada build de producción.
- El cron corre diariamente a las **00:05 UTC = 18:05 hora México (UTC-6)**, cerrando sesiones olvidadas.

Si tu biblioteca cambia de zona horaria o de hora de cierre, ajusta:

- El valor de `LIBRARY_CLOSE_HOUR` en [`lib/constants.ts`](./lib/constants.ts) (hora local).
- El `schedule` en `vercel.json` (expresión cron en **UTC**).

---

## 4. Primer deploy

1. En Vercel: **Add New → Project → Import** tu repositorio.
2. Framework preset: **Next.js** (autodetectado).
3. Root directory: `library-access` (si el repo contiene una carpeta raíz distinta).
4. Agrega las variables de entorno del paso 2.
5. Click en **Deploy**.

Vercel correrá `prisma migrate deploy && next build`. Si las tablas ya existen en Supabase (por ejemplo porque corriste `migrate dev` localmente), el paso de migrate simplemente marcará las migraciones como aplicadas y continuará.

---

## 5. Post-deploy

### Cambiar la contraseña del admin
1. Entra a `https://<tu-dominio>.vercel.app/admin/login`.
2. Usuario inicial (del seed): `admin@biblioteca.edu` / `admin123`.
3. Ir a **Mi cuenta** → cambiar contraseña.

### Imprimir el QR de instalación
1. En el panel admin, ir a **QR Instalación**.
2. Verifica que la URL mostrada sea el dominio de producción.
3. Click en **Imprimir** o **Descargar PNG**.
4. Colocar el QR físico en la entrada de la biblioteca.

### Verificar cron
- En Vercel: **Project → Settings → Cron Jobs** debe mostrar `/api/cron/auto-close` con el schedule.
- Puedes probarlo manualmente con:
  ```bash
  curl -X POST https://<tu-dominio>.vercel.app/api/cron/auto-close \
    -H "Authorization: Bearer <CRON_SECRET>"
  ```
  Debe responder `{"success":true,"closedSessions":N,"timestamp":"..."}`.

---

## 6. Rotación de secretos

Si necesitas invalidar sesiones admin o rotar el `CRON_SECRET`:

1. Generar nuevos valores con el comando de arriba.
2. Actualizar las env vars en Vercel.
3. Click en **Redeploy** del último deployment para que tome los nuevos valores.

Nota: al cambiar `JWT_SECRET`, todas las sesiones activas del admin quedan invalidadas y deben volver a loguearse.
