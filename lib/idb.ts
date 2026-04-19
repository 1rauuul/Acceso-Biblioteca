import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface StudentData {
  id: string;
  numeroControl: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  sexo: "M" | "F";
  carrera: string;
  semestre: number;
  deviceId: string;
  synced: boolean;
}

export interface AccessRecordLocal {
  localId: string;
  studentId: string;
  entryTime: string; // ISO string
  exitTime: string | null;
  synced: boolean;
}

export interface SurveyLocal {
  localId: string;
  accessRecordLocalId: string;
  studentId: string;
  stars: number;
  limpieza: number;
  mesas: number;
  silencio: number;
  comment: string;
  createdAt: string;
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
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<LibraryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("student", { keyPath: "id" });

        const recordStore = db.createObjectStore("records", {
          keyPath: "localId",
        });
        recordStore.createIndex("by-synced", "synced");
        recordStore.createIndex("by-student", "studentId");

        const surveyStore = db.createObjectStore("surveys", {
          keyPath: "localId",
        });
        surveyStore.createIndex("by-synced", "synced");

        db.createObjectStore("config", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function generateDeviceId(): string {
  const stored = localStorage.getItem("biblioteca-device-id");
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem("biblioteca-device-id", id);
  return id;
}

// ── Student ──

export async function getStudent(): Promise<StudentData | undefined> {
  const db = await getDB();
  const all = await db.getAll("student");
  return all[0];
}

export async function saveStudent(
  data: Omit<StudentData, "id" | "deviceId" | "synced">
): Promise<StudentData> {
  const db = await getDB();
  const student: StudentData = {
    ...data,
    id: generateId(),
    deviceId: generateDeviceId(),
    synced: false,
  };
  await db.put("student", student);
  return student;
}

export async function markStudentSynced(id: string) {
  const db = await getDB();
  const student = await db.get("student", id);
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

  const record: AccessRecordLocal = {
    localId: generateId(),
    studentId: student.id,
    entryTime: new Date().toISOString(),
    exitTime: null,
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

  session.exitTime = new Date().toISOString();
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

export async function markRecordSynced(localId: string) {
  const db = await getDB();
  const record = await db.get("records", localId);
  if (record) {
    record.synced = true;
    await db.put("records", record);
  }
}

// ── Surveys ──

export async function saveSurvey(
  data: Omit<SurveyLocal, "localId" | "createdAt" | "synced">
): Promise<SurveyLocal> {
  const db = await getDB();
  const survey: SurveyLocal = {
    ...data,
    localId: generateId(),
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.put("surveys", survey);
  await setConfig("lastSurveyDate", new Date().toISOString());
  requestBackgroundSync();
  return survey;
}

export async function getPendingSurveys(): Promise<SurveyLocal[]> {
  const db = await getDB();
  // Same reasoning as getPendingRecords: skip the boolean index.
  const all = await db.getAll("surveys");
  return all.filter((s) => !s.synced);
}

export async function markSurveySynced(localId: string) {
  const db = await getDB();
  const survey = await db.get("surveys", localId);
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

function requestBackgroundSync() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-records"))
      .catch(() => {});
  }
}

export async function syncWithServer(): Promise<{
  syncedRecords: number;
  syncedSurveys: number;
}> {
  const { student, pendingRecords, pendingSurveys } = await getAllSyncData();

  if (
    (!student || student.synced) &&
    pendingRecords.length === 0 &&
    pendingSurveys.length === 0
  ) {
    return { syncedRecords: 0, syncedSurveys: 0 };
  }

  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student: student && !student.synced ? student : null,
      studentNumeroControl: student?.numeroControl ?? null,
      records: pendingRecords,
      surveys: pendingSurveys,
    }),
  });

  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status}`);
  }

  const result = await res.json();

  if (student && !student.synced && result.studentSynced) {
    await markStudentSynced(student.id);
  }
  for (const localId of result.syncedRecordIds ?? []) {
    await markRecordSynced(localId);
  }
  for (const localId of result.syncedSurveyIds ?? []) {
    await markSurveySynced(localId);
  }

  return {
    syncedRecords: result.syncedRecordIds?.length ?? 0,
    syncedSurveys: result.syncedSurveyIds?.length ?? 0,
  };
}
