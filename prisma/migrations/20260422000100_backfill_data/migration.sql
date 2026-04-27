-- Migration B: backfill.
-- Populates the columns added in A using data already present in the database:
--   * creates a "legacy-unknown" device + one device per distinct students.device_id
--   * links students.current_device_id
--   * copies students.numero_control into access_records and survey_responses
--   * fills source_device_id and client_recorded_at for every existing row
-- Idempotent: can be re-run safely; every UPDATE is guarded by `IS NULL`
-- and INSERTs use ON CONFLICT DO NOTHING.

BEGIN;

-- 1) Legacy fallback device for orphan historical rows (stable UUID).
INSERT INTO "devices" ("id", "platform", "first_seen_at", "last_seen_at")
VALUES ('00000000-0000-0000-0000-000000000000', 'unknown', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- 2) One device row per distinct historical students.device_id.
--    We preserve the UUID when the stored value looks like a UUID;
--    otherwise we generate a fresh one (non-UUID legacy ids become untracked).
INSERT INTO "devices" ("id", "platform", "first_seen_at", "last_seen_at")
SELECT
  CASE
    WHEN s."device_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN s."device_id"::uuid
    ELSE gen_random_uuid()
  END AS id,
  'unknown'::"DevicePlatform",
  s."created_at",
  s."created_at"
FROM "students" s
WHERE s."device_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- 3) Link students.current_device_id for rows whose legacy device_id is a UUID.
UPDATE "students" s
SET "current_device_id" = s."device_id"::uuid
WHERE s."current_device_id" IS NULL
  AND s."device_id" IS NOT NULL
  AND s."device_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM "devices" d WHERE d."id" = s."device_id"::uuid
  );

-- 4) Backfill access_records.numero_control from the joined student.
UPDATE "access_records" ar
SET "numero_control" = s."numero_control"
FROM "students" s
WHERE ar."student_id" = s."id"
  AND ar."numero_control" IS NULL;

-- 5) Backfill survey_responses.numero_control the same way.
UPDATE "survey_responses" sr
SET "numero_control" = s."numero_control"
FROM "students" s
WHERE sr."student_id" = s."id"
  AND sr."numero_control" IS NULL;

-- 6) Backfill access_records.source_device_id and client_recorded_at.
--    Fallback to the legacy-unknown device when the student has no
--    current_device_id (i.e., historic rows without a tracked device).
UPDATE "access_records" ar
SET
  "source_device_id"   = COALESCE(
    (SELECT s."current_device_id"
       FROM "students" s
      WHERE s."numero_control" = ar."numero_control"),
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  "client_recorded_at" = COALESCE(ar."synced_at", ar."entry_time")
WHERE ar."source_device_id" IS NULL;

-- 7) Backfill survey_responses.source_device_id and client_recorded_at.
UPDATE "survey_responses" sr
SET
  "source_device_id"   = COALESCE(
    (SELECT s."current_device_id"
       FROM "students" s
      WHERE s."numero_control" = sr."numero_control"),
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  "client_recorded_at" = sr."created_at"
WHERE sr."source_device_id" IS NULL;

COMMIT;
