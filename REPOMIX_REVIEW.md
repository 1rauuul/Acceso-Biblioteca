# Revision profunda de `repomix-output.xml`

Fecha: 2026-05-25  
Proyecto: `library-access`  
Alcance: revision tecnica y funcional del contenido consolidado en `repomix-output.xml`

## Objetivo

Este documento resume una revision profunda del archivo `repomix-output.xml`, tratado como una representacion empaquetada del repositorio completo. El enfoque fue de code review: priorizar bugs reales, riesgos de seguridad, regresiones potenciales, integridad de datos y huecos de robustez.

## Hallazgos

- **Critico:** el bloque correspondiente a `app/api/sync/route.ts` dentro de `repomix-output.xml` permite sobrescribir el perfil de cualquier alumno existente usando solo `numeroControl`. La ruta es publica, no exige autenticacion ni prueba de posesion del dispositivo, y ademas actualiza campos maestros (`nombre`, apellidos, `sexo`, `carrera`, `semestre`, `currentDeviceId`). Eso significa que un cliente malicioso, un typo o un dispositivo viejo puede corromper datos de otro alumno y sesgar reportes posteriores.

```ts
export async function POST(request: NextRequest) {
  try {
    const body: SyncPayload = await request.json();
    // ...

    // 2) Student upsert keyed by numero_control. No client_recorded_at guard
    //    here: student data is master-data that only changes at registration.
    if (body.student && isControlNumber(body.student.numeroControl)) {
      const deviceId = isUuid(body.student.currentDeviceId)
        ? body.student.currentDeviceId
        : null;
      await prisma.student.upsert({
        where: { numeroControl: body.student.numeroControl },
        create: {
          numeroControl: body.student.numeroControl,
          nombre: body.student.nombre,
          apellidoPaterno: body.student.apellidoPaterno,
          apellidoMaterno: body.student.apellidoMaterno,
          sexo: body.student.sexo,
          carrera: body.student.carrera as Carrera,
          semestre: body.student.semestre,
          currentDeviceId: deviceId,
        },
        update: {
          nombre: body.student.nombre,
          apellidoPaterno: body.student.apellidoPaterno,
          apellidoMaterno: body.student.apellidoMaterno,
          sexo: body.student.sexo,
          carrera: body.student.carrera as Carrera,
          semestre: body.student.semestre,
          currentDeviceId: deviceId,
        },
      });
```

- **Alto:** la reconciliacion de cierre puede adulterar el `exit_time` autoritativo del cron. En `app/salida/page.tsx`, si ya paso la hora de cierre, el cliente hace `createExit()` local; `createExit()` sella `exitTime` y `clientRecordedAt` con la hora actual; y luego `/api/sync` deja ganar siempre al timestamp de cliente mas nuevo. Resultado: una visita que el cron cerro a las 18:00 puede terminar reescrita como 20:00 por un dispositivo offline, y ademas conservar `autoClosed=true`, dejando datos incoherentes para metricas y auditoria.

```ts
if (pastClose) {
  await createExit();
  if (!cancelled) router.replace("/entrada");
  return true;
}
```

```ts
const now = new Date().toISOString();
session.exitTime = now;
// The most recent client-side mutation wins on the server's conflict guard.
session.clientRecordedAt = now;
session.synced = false;
```

```ts
ON CONFLICT ("id") DO UPDATE SET
  "exit_time"          = EXCLUDED."exit_time",
  "client_recorded_at" = EXCLUDED."client_recorded_at",
  "synced_at"          = now()
WHERE EXCLUDED."client_recorded_at" >= "access_records"."client_recorded_at"
```

- **Alto:** el bootstrap del panel admin usa credenciales conocidas y publicas. En `prisma/seed.ts` se crea `admin@biblioteca.edu / admin123`, y el `README.md` tambien lo documenta. En cualquier despliegue donde se ejecute el seed y nadie cambie la contrasena de inmediato, el panel queda comprometible desde el inicio.

```ts
async function main() {
  const email = "admin@biblioteca.edu";
  const password = "admin123";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: "Administrador",
    },
  });

  console.log(`Admin user created: ${email} / ${password}`);
  console.log("IMPORTANT: Change this password in production!");
}
```

- **Medio-alto:** `lib/auth.ts` falla abierto. Si falta `JWT_SECRET`, la app sigue funcionando con un secreto predecible (`"dev-secret-change-in-production"`) en vez de abortar. Un error de configuracion no deberia degradarse a un esquema donde cualquiera que conozca el codigo pueda forjar sesiones admin.

```ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);
```

- **Medio:** el modo visitante esta expuesto como si fuera funcional, pero hoy es un callejon sin salida. `app/registro/page.tsx` permite cambiar a `VisitanteForm`, pero ese componente solo captura campos y ofrece volver; no hay submit, no guarda nada en IndexedDB, no sincroniza y no navega a un siguiente paso. Si esta UI ya esta visible para usuarios, es un bug de producto, no solo deuda tecnica.

- **Medio:** `app/api/reports/route.ts` consume `page` y `limit` sin sanitizacion real antes de pasarlos a Prisma y de calcular `totalPages`. Un `limit=0`, `NaN`, negativo o exageradamente grande puede provocar 500, paginacion invalida o consultas mucho mas pesadas de lo previsto. Como el endpoint esta detras del panel, no es critico, pero si es un bug claro de robustez.

## Supuestos y dudas

- Asumo que los datos del alumno deberian quedar protegidos contra sobrescrituras por clientes anonimos despues del registro inicial.
- Asumo que el cron de auto-cierre pretende ser la fuente de verdad cuando la biblioteca ya cerro, y que el fallback local solo deberia reconciliarse, no reescribir esa decision.
- Asumo que el modo visitante no es un mock visual, porque la UI lo presenta como flujo disponible.
- No vi pruebas especificas para conflictos offline/cron/autocierre ni para endurecimiento de auth; ahi esta el mayor riesgo residual del sistema.

## Resumen

La base esta bien pensada: PWA offline-first, reverse sync desde service worker, cron de autocierre, panel protegido en rutas server-side y constraints utiles en base de datos. El problema no esta en la idea general, sino en dos capas sensibles: integridad de sincronizacion y defaults de seguridad.

Antes de llamarlo listo para produccion, yo priorizaria asi: `1)` endurecer `/api/sync` para que no pueda mutar perfiles arbitrarios, `2)` corregir el conflicto entre autocierre del cron y `createExit()` local, `3)` eliminar credenciales/secreto por defecto, y `4)` decidir si el modo visitante se implementa o se oculta.

## Recomendacion ejecutiva

Para presentacion, el mensaje central puede resumirse asi:

> El sistema tiene una arquitectura funcional y varias decisiones tecnicas acertadas, pero hoy presenta riesgos serios de integridad de datos y de seguridad operacional que deben corregirse antes de considerarlo listo para produccion.

## Archivos implicados en los hallazgos

- `app/api/sync/route.ts`
- `app/salida/page.tsx`
- `lib/idb.ts`
- `prisma/seed.ts`
- `README.md`
- `lib/auth.ts`
- `app/registro/page.tsx`
- `app/api/reports/route.ts`

## Prioridad sugerida

1. Bloquear la sobrescritura arbitraria de alumnos en `/api/sync`.
2. Corregir la colision entre auto-cierre por cron y cierre local offline.
3. Eliminar credenciales admin por defecto y fallbacks inseguros de JWT.
4. Definir el destino del flujo de visitante: implementarlo o retirarlo.
5. Validar y acotar `page` y `limit` en reportes/exportes.
