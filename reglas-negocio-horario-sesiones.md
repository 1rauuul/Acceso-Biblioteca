# Especificación de Reglas de Negocio (SSD)
## Control de Horario de Atención y Gestión de Sesiones — PWA Biblioteca

---

## 1. Contexto

Sistema de registro de entrada para estudiantes en una biblioteca universitaria (PWA offline-first con Next.js + Prisma/PostgreSQL desplegada en Vercel). Este documento especifica las reglas de negocio relacionadas con el horario de atención y el ciclo de vida de las sesiones, en un formato estructurado para que un agente automatizado (o desarrollador) pueda implementarlas y/o ejecutarlas directamente.

---

## 2. Definiciones

| Término | Valor |
|---|---|
| Zona horaria de referencia | `America/Mexico_City` (CST, UTC-6 fijo; sin horario de verano desde 2022) |
| Días de atención | Lunes – viernes |
| Horario de atención | `07:00` – `18:00` |
| Ventana lógica de aceptación de login | `06:55` – `18:03` |
| Hora de cierre automático de sesiones | `18:03` |
| Duración máxima de sesión | `3 horas` |
| Duración mínima válida de sesión | `9 minutos` |

---

## 3. Reglas de Negocio

### RN-01 — Rechazo de registro de entrada fuera de horario de atención

- **Trigger:** intento de registro de entrada (check-in) por parte de un usuario.
- **Condición:** `hora_actual < 07:00` **OR** `hora_actual > 18:00` (hora México).
- **Acción:** rechazar el registro. Mostrar pop-up con el mensaje: *"No está en horario de atención"*.
- **Prioridad:** Alta.
- **Punto de aplicación:** página `/entrada` (rutas manual y QR), antes de crear el registro local en IndexedDB.

### RN-02 — Cierre automático de sesiones por fin de horario

- **Trigger:** el reloj del sistema alcanza las `18:03` hora México.
- **Condición:** existen sesiones activas iniciadas dentro del horario válido.
- **Acción:** cerrar automáticamente todas las sesiones activas (sellando `exit_time` a las `18:00`, la hora real de cierre; `18:03` es solo el disparador).
- **Prioridad:** Alta.
- **Notas de implementación:** Vercel Cron (`vercel.json`, schedule `3 0 * * *` UTC = 18:03 México) que invoca `/api/cron/auto-close`, más una red de seguridad nativa `pg_cron` (job `library-auto-close`, migración `20260915000200_business_hours_enforcement`). El backfill usa `LEAST(entry + duración promedio del estudiante, entry + 3h, 18:00)`.

### RN-03 — Cierre automático de sesiones por duración máxima

- **Trigger:** evaluación periódica de sesiones activas (o verificación en cada request).
- **Condición:** `tiempo_transcurrido(sesión) > 3 horas`.
- **Acción:** cerrar automáticamente la sesión sellando `exit_time = entry_time + 3h`.
- **Prioridad:** Alta.
- **Notas de implementación:** esta regla es independiente de la hora del día; aplica en cualquier momento dentro del horario de atención. Se aplica en tres puntos: (a) el reconcile de 30 s de `/salida` sella la sesión localmente al cumplir el mínimo de `entry+3h` y el cierre de las `18:00`; (b) `/api/sync` limita `exit_time` a `entry+3h` al insertar (marcando `auto_closed` para que el tope sea autoritativo); (c) el cron diario de respaldo aplica el mismo tope.

### RN-04 — Descarte de logins fuera de la ventana lógica

- **Trigger:** intento de login/registro.
- **Condición:** `hora_actual < 06:55` **OR** `hora_actual > 18:03` (hora México).
- **Acción:** descartar el intento sin crear ningún registro en la base de datos.
- **Prioridad:** Alta.
- **Notas:** evita ensuciar la base de datos con registros inválidos fuera de la ventana operativa. `/api/auth/student-login` responde `403` con *"No está en horario de atención"* antes de tocar la base de datos; `/api/sync` además descarta registros cuyo `entry_time` caiga fuera de la ventana (protección contra relojes de dispositivo desincronizados), devolviendo `discardedRecordIds` para que el cliente los elimine de IndexedDB.

### RN-05 — Descarte de sesiones menores a 9 minutos

- **Trigger:** intento de cierre o sincronización de una sesión.
- **Condición:** `tiempo_transcurrido(sesión) < 9 minutos`.
- **Acción:** eliminar el registro local y volver al flujo normal de entrada sin sincronizarlo. El servidor también descarta cualquier registro corto recibido por clientes antiguos o manipulados antes de ejecutar el `INSERT`.
- **Prioridad:** Alta.
- **Nota:** una duración exacta de `9 minutos` sí es válida.

### RN-06 — Rechazo de login en fin de semana

- **Trigger:** intento de login o registro de entrada en sábado o domingo.
- **Condición:** día local en `America/Mexico_City` es sábado o domingo.
- **Acción:** rechazar antes de tocar la base de datos con el mensaje: *"No está en horario de atención. La biblioteca opera de lunes a viernes."*
- **Prioridad:** Alta.
- **Puntos de aplicación:** `/api/auth/student-login`, `/entrada` y `/api/sync`.

---

## 4. Resumen de ventanas horarias (hora México)

| Rango horario | Estado | Comportamiento |
|---|---|---|
| Sábado y domingo | Días sin atención | Login y registro de entrada descartados (RN-06) |
| `< 06:55` (lunes-viernes) | Fuera de ventana lógica | Login descartado, sin registro (RN-04) |
| `06:55 – 07:00` | Buffer de pre-apertura | Login aceptado a nivel lógico, pero el registro de entrada se rechaza con pop-up (RN-01) |
| `07:00 – 18:00` | Horario de atención | Operación normal de registro |
| `18:00 – 18:03` | Buffer de pre-cierre | Login aceptado a nivel lógico; a las 18:03 se disparan los cierres automáticos (RN-02) |
| `> 18:03` | Fuera de ventana lógica | Login descartado, sin registro (RN-04) |

---

## 5. Consideraciones de implementación

- Todos los cálculos de hora se normalizan a `America/Mexico_City`, que es CST (UTC-6) fijo desde 2022 (México abolió el horario de verano); los helpers en `lib/datetime.ts` usan el offset fijo, `isLibraryWeekday` bloquea sábado y domingo, y las comparaciones de `Date` se hacen en UTC.
- Las marcas de tiempo se almacenan en UTC en la base de datos; las ventanas horarias se evalúan convirtiendo a hora México (`mxMinutesOfDay`, `isWithinServiceHours`, `isWithinLoginWindow`, `sessionDeadlineUtc`).
- El check-in es offline-first: se crea en IndexedDB (`createEntry`) y se sincroniza por `/api/sync` (o Background Sync vía service worker). Por eso RN-01 se valida en el cliente (pop-up) y RN-04/RN-03 se re-validan en el servidor al sincronizar (defensa en profundidad).
- RN-02: Vercel Cron (`3 0 * * *` UTC) + job `pg_cron` redundante como red de seguridad.
- RN-03: reconcile cada 30 s en `/salida` + tope en `/api/sync` + tope en el cron de respaldo. No se usa un cron cada 5–10 min: los cierres en reposo se resuelven en la siguiente sincronización del dispositivo o en el cron diario, con el tope de 3 h garantizado al insertar.
- RN-01 y RN-04 se validan en el mismo punto de entrada antes de tocar la base de datos (pop-up en `/entrada`; `403` en `student-login`; descarte en `sync`) para evitar registros inválidos.
- RN-05 se filtra antes de la sincronización: `createExit()` elimina sesiones cerradas menores a 9 minutos y `/api/sync` solo envía sesiones abiertas con al menos 9 minutos o sesiones cerradas con duración válida.

---

## 6. Mapeo regla → código

| Regla | Archivo(s) |
|---|---|
| RN-01 | `app/entrada/page.tsx`, `lib/datetime.ts` (`isWithinServiceHours`) |
| RN-02 | `vercel.json`, `app/api/cron/auto-close/route.ts`, `prisma/migrations/20260915000200_business_hours_enforcement/migration.sql`, `app/salida/page.tsx` |
| RN-03 | `app/salida/page.tsx` (`sessionDeadlineUtc`), `app/api/sync/route.ts`, `app/api/cron/auto-close/route.ts`, migración pg_cron |
| RN-04 | `app/api/auth/student-login/route.ts`, `app/api/sync/route.ts`, `lib/idb.ts` (`discardedRecordIds`) |
| RN-05 | `lib/datetime.ts` (`isSessionLongEnough`), `lib/idb.ts`, `app/salida/page.tsx`, `app/api/sync/route.ts` |
| RN-06 | `lib/datetime.ts` (`isLibraryWeekday`), `app/api/auth/student-login/route.ts`, `app/entrada/page.tsx`, `app/api/sync/route.ts` |
| Constantes | `lib/constants.ts` (`LIBRARY_OPEN_HOUR`, `LIBRARY_CLOSE_HOUR`, `LIBRARY_MAX_SESSION_MINUTES`, buffers `06:55`/`18:03`) |
