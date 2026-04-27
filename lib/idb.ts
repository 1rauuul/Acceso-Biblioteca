import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StudentData {
  numeroControl: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  sexo: "M" | "F";
  carrera: string;
  semestre: number;
  currentDeviceId: string;
  synced: boolean;
}

export interface AccessRecordLocal {
  id: string; // UUID, client-generated. Primary key server-side too.
  numeroControl: string; // FK to students.numero_control
  entryTime: string; // ISO
  exitTime: string | null; // ISO
  clientRecordedAt: string; // ISO — when the entry/exit actually happened
  sourceDeviceId: string; // UUID of the device that created the row
  synced: boolean;
}

export interface SurveyLocal {
  id: string; // UUID, client-generated
  numeroControl: string;
  accessRecordId: string; // UUID pointing at the closed AccessRecord
  stars: number;
  limpieza: number;
  mesas: number;
  silencio: number;
  comment: string;
  sourceDeviceId: string;
  clientRecordedAt: string; // ISO — when the user submitted the survey
  createdAt: string; // ISO — same as clientRecordedAt; retained for UX
  synced: boolean;
}

export interface ConfigEntry {
  key: string;
  value: string;
}

interface LibraryDB extends DBSchema {
  student: {
    key: string;
    value: StudentData;
  };
  records: {
    key: string;
    value: AccessRecordLocal;
    indexes: { "by-synced": string; "by-student": string };
  };
  surveys: {
    key: string;
    value: SurveyLocal;
    indexes: { "by-synced": string };
  };
  config: {
    key: string;
    value: ConfigEntry;
  };
}

const DB_NAME = "biblioteca-escuela";
const DB_VERSION = 2;

const DEVICE_ID_KEY = "biblioteca-device-id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers: RFC4122 v4 via getRandomValues.
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? (globalThis as unknown as { msCrypto: Crypto }).msCrypto).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function getOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") return newUuid();
  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored && isUuid(stored)) return stored;
  const id = newUuid();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<LibraryDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("student", { keyPath: "numeroControl" });
          const recordStore = db.createObjectStore("records", { keyPath: "id" });
          recordStore.createIndex("by-synced", "synced");
          recordStore.createIndex("by-student", "numeroControl");
          const surveyStore = db.createObjectStore("surveys", { keyPath: "id" });
          surveyStore.createIndex("by-synced", "synced");
          db.createObjectStore("config", { keyPath: "key" });
          return;
        }

        // v1 → v2: keyPaths changed (`student.id` → `student.numeroControl`,
        // `records.localId` → `records.id`, `surveys.localId` → `surveys.id`)
        // and the shape of each row was extended with offline-first fields.
        if (oldVersion < 2) {
          const legacyStudents = (await tx
            .objectStore("student")
            .getAll()) as unknown as Array<{
            id?: string;
            numeroControl: string;
            nombre: string;
            apellidoPaterno: string;
            apellidoMaterno: string;
            sexo: "M" | "F";
            carrera: string;
            semestre: number;
            deviceId?: string;
            synced?: boolean;
          }>;
          const legacyRecords = (await tx
            .objectStore("records")
            .getAll()) as unknown as Array<{
            localId: string;
            studentId: string;
            entryTime: string;
            exitTime: string | null;
            synced?: boolean;
          }>;
          const legacySurveys = (await tx
            .objectStore("surveys")
            .getAll()) as unknown as Array<{
            localId: string;
            accessRecordLocalId: string;
            studentId: string;
            stars: number;
            limpieza: number;
            mesas: number;
            silencio: number;
            comment: string;
            createdAt: string;
            synced?: boolean;
          }>;

          db.deleteObjectStore("student");
          db.deleteObjectStore("records");
          db.deleteObjectStore("surveys");

          db.createObjectStore("student", { keyPath: "numeroControl" });
          const recordStore = db.createObjectStore("records", { keyPath: "id" });
          recordStore.createIndex("by-synced", "synced");
          recordStore.createIndex("by-student", "numeroControl");
          const surveyStore = db.createObjectStore("surveys", { keyPath: "id" });
          surveyStore.createIndex("by-synced", "synced");

          const deviceId =
            (typeof localStorage !== "undefined" &&
              localStorage.getItem(DEVICE_ID_KEY)) ||
            newUuid();
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
          }

          const sStore = tx.objectStore("student");
          for (const s of legacyStudents) {
            await sStore.put({
              numeroControl: s.numeroControl,
              nombre: s.nombre,
              apellidoPaterno: s.apellidoPaterno,
              apellidoMaterno: s.apellidoMaterno,
              sexo: s.sexo,
              carrera: s.carrera,
              semestre: s.semestre,
              currentDeviceId: isUuid(s.deviceId) ? s.deviceId! : deviceId,
              synced: s.synced ?? false,
            });
          }

          // All historical local rows belong to the single locally registered
          // student: resolve numero_control from the first (and only) student.
          const localNumeroControl = legacyStudents[0]?.numeroControl ?? "";

          const rStore = tx.objectStore("records");
          for (const r of legacyRecords) {
            const id = isUuid(r.localId) ? r.localId : newUuid();
            await rStore.put({
              id,
              numeroControl: localNumeroControl,
              entryTime: r.entryTime,
              exitTime: r.exitTime,
              clientRecordedAt: r.entryTime,
              sourceDeviceId: deviceId,
              synced: r.synced ?? false,
            });
          }

          const surveyStore2 = tx.objectStore("surveys");
          for (const s of legacySurveys) {
            const id = isUuid(s.localId) ? s.localId : newUuid();
            if (!isUuid(s.accessRecordLocalId)) {
              // Without a resolvable UUID for the access_record we cannot
              // upload this survey; mark it synced to stop retries.
              await surveyStore2.put({
                id,
                numeroControl: localNumeroControl,
                accessRecordId: "00000000-0000-0000-0000-000000000000",
                stars: s.stars,
                limpieza: s.limpieza,
                mesas: s.mesas,
                silencio: s.silencio,
                comment: s.comment,
                sourceDeviceId: deviceId,
                clientRecordedAt: s.createdAt,
                createdAt: s.createdAt,
                synced: true,
              });
              continue;
            }
            await surveyStore2.put({
              id,
              numeroControl: localNumeroControl,
              accessRecordId: s.accessRecordLocalId,
              stars: s.stars,
              limpieza: s.limpieza,
              mesas: s.mesas,
              silencio: s.silencio,
              comment: s.comment,
              sourceDeviceId: deviceId,
              clientRecordedAt: s.createdAt,
              createdAt: s.createdAt,
              synced: s.synced ?? false,
            });
          }
        }
      },
    });
  }
  return dbPromise;
}

// ── Student ──

export async function getStudent(): Promise<StudentData | undefined> {
  const db = await getDB();
  const all = await db.getAll("student");
  return all[0];
}

export async function saveStudent(
  data: Omit<StudentData, "currentDeviceId" | "synced">
): Promise<StudentData> {
  const db = await getDB();
  const student: StudentData = {
    ...data,
    currentDeviceId: getOrCreateDeviceId(),
    synced: false,
  };
  await db.put("student", student);
  return student;
}

export async function markStudentSynced(numeroControl: string) {
  const db = await getDB();
  const student = await db.get("student", numeroControl);
  if (student) {
    student.synced = true;
    await db.put("student", student);
  }
}

// ── Access Records ──

export async function getCurrentSession(): Promise<
  AccessRecordLocal | undefined
> {
  const db = await getDB();
  const all = await db.getAll("records");
  return all.find((r) => r.exitTime === null);
}

export async function createEntry(): Promise<AccessRecordLocal> {
  const db = await getDB();
  const student = await getStudent();
  if (!student) throw new Error("No student registered");

  const now = new Date().toISOString();
  const record: AccessRecordLocal = {
    id: newUuid(),
    numeroControl: student.numeroControl,
    entryTime: now,
    exitTime: null,
    clientRecordedAt: now,
    sourceDeviceId: getOrCreateDeviceId(),
    synced: false,
  };
  await db.put("records", record);
  requestBackgroundSync();
  return record;
}

export async function createExit(): Promise<AccessRecordLocal | undefined> {
  const db = await getDB();
  const session = await getCurrentSession();
  if (!session) return undefined;

  const now = new Date().toISOString();
  session.exitTime = now;
  // The most recent client-side mutation wins on the server's conflict guard.
  session.clientRecordedAt = now;
  session.synced = false;
  await db.put("records", session);
  requestBackgroundSync();
  return session;
}

export async function getLastClosedRecord(): Promise<
  AccessRecordLocal | undefined
> {
  const db = await getDB();
  const all = await db.getAll("records");
  const closed = all.filter((r) => r.exitTime !== null);
  if (closed.length === 0) return undefined;
  return closed.reduce((latest, r) =>
    new Date(r.exitTime!).getTime() > new Date(latest.exitTime!).getTime()
      ? r
      : latest
  );
}

export async function getPendingRecords(): Promise<AccessRecordLocal[]> {
  const db = await getDB();
  // We intentionally avoid the `by-synced` index because IndexedDB does not
  // accept boolean values as valid index keys. Filtering in memory is safe
  // here: the local records store never holds more than a handful of rows
  // per device.
  const all = await db.getAll("records");
  return all.filter((r) => !r.synced);
}

export async function markRecordSynced(id: string) {
  const db = await getDB();
  const record = await db.get("records", id);
  if (record) {
    record.synced = true;
    await db.put("records", record);
  }
}

// ── Surveys ──

export async function saveSurvey(
  data: Omit<
    SurveyLocal,
    | "id"
    | "createdAt"
    | "synced"
    | "sourceDeviceId"
    | "clientRecordedAt"
  >
): Promise<SurveyLocal> {
  const db = await getDB();
  const now = new Date().toISOString();
  const survey: SurveyLocal = {
    ...data,
    id: newUuid(),
    sourceDeviceId: getOrCreateDeviceId(),
    clientRecordedAt: now,
    createdAt: now,
    synced: false,
  };
  await db.put("surveys", survey);
  await setConfig("lastSurveyDate", now);
  requestBackgroundSync();
  return survey;
}

export async function getPendingSurveys(): Promise<SurveyLocal[]> {
  const db = await getDB();
  // Same reasoning as getPendingRecords: skip the boolean index.
  const all = await db.getAll("surveys");
  return all.filter((s) => !s.synced);
}

export async function markSurveySynced(id: string) {
  const db = await getDB();
  const survey = await db.get("surveys", id);
  if (survey) {
    survey.synced = true;
    await db.put("surveys", survey);
  }
}

export async function shouldShowSurvey(): Promise<boolean> {
  const db = await getDB();
  const allSurveys = await db.getAll("surveys");
  if (allSurveys.length === 0) return true;

  const lastDate = await getConfig("lastSurveyDate");
  if (!lastDate) return true;

  const daysSinceLast = Math.floor(
    (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceLast >= 30;
}

// ── Config ──

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDB();
  const entry = await db.get("config", key);
  return entry?.value;
}

export async function setConfig(key: string, value: string) {
  const db = await getDB();
  await db.put("config", { key, value });
}

// ── Sync helpers ──

export async function getAllSyncData() {
  const student = await getStudent();
  const pendingRecords = await getPendingRecords();
  const pendingSurveys = await getPendingSurveys();
  return { student, pendingRecords, pendingSurveys };
}

async function getOpenRecordIds(): Promise<string[]> {
  const db = await getDB();
  const all = await db.getAll("records");
  return all.filter((r) => r.exitTime === null).map((r) => r.id);
}

async function applyServerExitTime(
  id: string,
  exitTimeIso: string
): Promise<void> {
  const db = await getDB();
  const record = await db.get("records", id);
  if (!record) return;
  if (record.exitTime) return;
  record.exitTime = exitTimeIso;
  record.synced = true;
  await db.put("records", record);
}

function requestBackgroundSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) =>
        (
          reg as unknown as {
            sync: { register: (tag: string) => Promise<void> };
          }
        ).sync.register("sync-records")
      )
      .catch(() => {});
  }
}

export async function syncWithServer(): Promise<{
  syncedRecords: number;
  syncedSurveys: number;
  serverClosedRecords: number;
}> {
  const { student, pendingRecords, pendingSurveys } = await getAllSyncData();
  const openRecordIds = await getOpenRecordIds();

  // Skip the network round-trip only if there is literally nothing to push
  // AND nothing to reconcile (no open sessions to check against the server).
  if (
    (!student || student.synced) &&
    pendingRecords.length === 0 &&
    pendingSurveys.length === 0 &&
    openRecordIds.length === 0
  ) {
    return { syncedRecords: 0, syncedSurveys: 0, serverClosedRecords: 0 };
  }

  const deviceId = getOrCreateDeviceId();

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student: student && !student.synced ? student : null,
      device: {
        id: deviceId,
        platform: detectPlatform(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
      records: pendingRecords,
      surveys: pendingSurveys,
      openRecordIds,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status}`);
  }

  const result = await res.json();

  if (student && !student.synced && result.studentSynced) {
    await markStudentSynced(student.numeroControl);
  }
  for (const id of result.syncedRecordIds ?? []) {
    await markRecordSynced(id);
  }
  for (const id of result.syncedSurveyIds ?? []) {
    await markSurveySynced(id);
  }

  // Reverse-sync: apply server-side closures (typically from the auto-close
  // cron) to our local IndexedDB so the PWA stops saying "Dentro desde…"
  // after the library closes.
  let serverClosedRecords = 0;
  const serverRecords: {
    id: string;
    exitTime: string | null;
    autoClosed: boolean;
  }[] = result.serverRecords ?? [];
  for (const sr of serverRecords) {
    if (sr.exitTime) {
      await applyServerExitTime(sr.id, sr.exitTime);
      serverClosedRecords++;
    }
  }

  return {
    syncedRecords: result.syncedRecordIds?.length ?? 0,
    syncedSurveys: result.syncedSurveyIds?.length ?? 0,
    serverClosedRecords,
  };
}

function detectPlatform(): "ios" | "android" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/mac|win|linux/.test(ua)) return "desktop";
  return "unknown";
}
