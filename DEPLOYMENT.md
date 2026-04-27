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

---

## 7. Migración del esquema offline-first (Abril 2026)

Esta es una migración destructiva (`migration C`) que cambia la PK de `students` de un `cuid` a `numero_control`, convierte `id` de `access_records` y `survey_responses` a UUID, y agrega la tabla `devices`. **Requiere snapshot previo** y un cambio sincronizado de cliente + servidor.

### Orden obligatorio de despliegue

1. **Snapshot de Supabase**: `Project → Database → Backups → Create backup` (o `pg_dump` manual vía `DIRECT_URL`). Guarda el identificador del snapshot — es tu rollback.
2. **Modo mantenimiento opcional**: si tienes tráfico significativo, pon la app en mantenimiento durante ~5 min. Solo afecta a inserts; lectores siguen funcionando.
3. **Aplica las migraciones A→D** en orden. Cada una está en un directorio aparte bajo `prisma/migrations/`:
   - `20260422000000_add_offline_columns` (aditiva, sin downtime)
   - `20260422000100_backfill_data` (aditiva, idempotente)
   - `20260422000200_repk_students_by_numero_control` (destructiva; rollback = restaurar snapshot)
   - `20260422000300_finalize_constraints_and_types` (tipos + GENERATED + CHECKs)
   - `20260422000400_pg_cron_auto_close` (opcional; omite si tu plan de Supabase no tiene `pg_cron`)

   Se despliegan automáticamente con `prisma migrate deploy` en el build de Vercel. Si prefieres aplicarlas manualmente desde local:

   ```bash
   DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
   ```

4. **Deploy de la app** (cliente + server en el mismo commit). El cliente bump `DB_VERSION` a 2 de IndexedDB automáticamente al abrir la PWA; no hace falta que los usuarios reinstalen.

### Queries de validación post-migración

Córrelos en el SQL Editor de Supabase tras las migraciones A→D. Cualquier fila devuelta indica un problema.

```sql
-- 1. Nadie debe tener numero_control nulo en children.
SELECT 'access_records' AS tabla, COUNT(*) AS nulls
FROM "access_records" WHERE "numero_control" IS NULL
UNION ALL
SELECT 'survey_responses', COUNT(*)
FROM "survey_responses" WHERE "numero_control" IS NULL;

-- 2. Todos los children deben apuntar a un student existente.
SELECT ar."id"
FROM "access_records" ar
LEFT JOIN "students" s ON s."numero_control" = ar."numero_control"
WHERE s."numero_control" IS NULL;

SELECT sr."id"
FROM "survey_responses" sr
LEFT JOIN "students" s ON s."numero_control" = sr."numero_control"
WHERE s."numero_control" IS NULL;

-- 3. duration_minutes (GENERATED) debe coincidir con exit_time - entry_time.
SELECT "id",
       "duration_minutes",
       GREATEST(0, (EXTRACT(EPOCH FROM ("exit_time" - "entry_time")) / 60)::int) AS calc
FROM "access_records"
WHERE "exit_time" IS NOT NULL
  AND "duration_minutes" IS DISTINCT FROM
      GREATEST(0, (EXTRACT(EPOCH FROM ("exit_time" - "entry_time")) / 60)::int);

-- 4. numero_control único y cumple formato.
SELECT "numero_control", COUNT(*)
FROM "students"
GROUP BY "numero_control"
HAVING COUNT(*) > 1;

SELECT "numero_control"
FROM "students"
WHERE "numero_control" !~ '^[A-Za-z0-9-]{4,20}$';

-- 5. Todas las sesiones abiertas deben ser de hoy (o el cron las cerrará).
SELECT "id", "entry_time", "numero_control"
FROM "access_records"
WHERE "exit_time" IS NULL
  AND "entry_time" < (now() AT TIME ZONE 'America/Mexico_City')::date;

-- 6. Conteos antes/después deben coincidir (comparar con el snapshot).
SELECT 'students' AS tabla, COUNT(*) FROM "students"
UNION ALL SELECT 'access_records', COUNT(*) FROM "access_records"
UNION ALL SELECT 'survey_responses', COUNT(*) FROM "survey_responses"
UNION ALL SELECT 'devices', COUNT(*) FROM "devices"
UNION ALL SELECT 'admin_users', COUNT(*) FROM "admin_users";

-- 7. FK ON UPDATE CASCADE funciona (test no-destructivo).
BEGIN;
  UPDATE "students" SET "numero_control" = "numero_control" || '-X'
  WHERE "numero_control" = (SELECT "numero_control" FROM "students" LIMIT 1);
  -- ...verifica que las filas en access_records se actualizaron también...
ROLLBACK;
```

### Rollback

Si alguna validación falla tras `migration_C`:

1. En Supabase: **Database → Backups → Restore** usando el snapshot del paso 1.
2. Revierte el deploy en Vercel (**Deployments → el anterior → Promote to Production**).
3. Los clientes PWA seguirán en `DB_VERSION = 2` localmente; al recibir el servidor viejo, la sincronización fallará con 500 pero los datos locales sobreviven. Forzarlos a `DB_VERSION = 1` requiere limpiar el storage del sitio (o un `location.reload()` tras publicar un hotfix que baje el DB_VERSION, lo cual no recomendamos — mejor avanzar con el fix).

### pg_cron (migración E, opcional)

- Requiere plan de Supabase con la extensión habilitada (Pro+).
- Si no aplicas la migración E, el único cron de auto-close es el de Vercel definido en `vercel.json`. Sigue siendo suficiente; `pg_cron` es solo redundancia.
- Para quitar el job programado:
  ```sql
  SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'library-auto-close';
  ```

