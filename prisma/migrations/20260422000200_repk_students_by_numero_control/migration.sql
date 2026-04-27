-- Migration C: re-PK (destructive step; REQUIRES a Supabase snapshot beforehand).
-- Promotes students.numero_control to the primary key, drops the old cuid id
-- column, and migrates access_records.id / survey_responses.id to UUIDs
-- reusing the existing local_id where it was already a valid UUID.

BEGIN;

-- 1) Drop all FKs that point at the old TEXT ids (so we can drop columns).
ALTER TABLE "access_records"   DROP CONSTRAINT "access_records_student_id_fkey";
ALTER TABLE "survey_responses" DROP CONSTRAINT "survey_responses_student_id_fkey";
ALTER TABLE "survey_responses" DROP CONSTRAINT "survey_responses_access_record_id_fkey";

-- 2) Compute the new UUID id for every access_record (reuse local_id when possible).
ALTER TABLE "access_records" ADD COLUMN "id_new" UUID;
UPDATE "access_records"
SET "id_new" = CASE
  WHEN "local_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN "local_id"::uuid
  ELSE gen_random_uuid()
END;

-- 3) Re-point survey_responses.access_record_id onto the new UUIDs.
CREATE TEMP TABLE "_access_id_map" AS
  SELECT "id" AS old_id, "id_new" AS new_id FROM "access_records";

ALTER TABLE "survey_responses" ADD COLUMN "access_record_id_new" UUID;
UPDATE "survey_responses" sr
SET "access_record_id_new" = m.new_id
FROM "_access_id_map" m
WHERE sr."access_record_id" = m.old_id;

-- 4) Generate fresh UUIDs for survey_responses.id (no prior local_id existed).
ALTER TABLE "survey_responses" ADD COLUMN "id_new" UUID DEFAULT gen_random_uuid();
UPDATE "survey_responses" SET "id_new" = gen_random_uuid() WHERE "id_new" IS NULL;

-- 5) Drop the old primary keys (and the redundant unique on numero_control,
--    which the new PK will replace).
ALTER TABLE "students"         DROP CONSTRAINT "students_pkey";
DROP INDEX IF EXISTS "students_numero_control_key";
ALTER TABLE "access_records"   DROP CONSTRAINT "access_records_pkey";
ALTER TABLE "survey_responses" DROP CONSTRAINT "survey_responses_pkey";

-- 6) Drop obsolete columns.
--    students.id  → replaced by numero_control as PK.
--    students.device_id → replaced by current_device_id (a FK to devices).
--    access_records: drop server cuid + old student_id + local_id.
--    survey_responses: same.
ALTER TABLE "students"         DROP COLUMN "id";
ALTER TABLE "students"         DROP COLUMN "device_id";
ALTER TABLE "access_records"   DROP COLUMN "id";
ALTER TABLE "access_records"   DROP COLUMN "student_id";
ALTER TABLE "access_records"   DROP COLUMN "local_id";
ALTER TABLE "survey_responses" DROP COLUMN "id";
ALTER TABLE "survey_responses" DROP COLUMN "student_id";
ALTER TABLE "survey_responses" DROP COLUMN "access_record_id";

-- 7) Rename the shadow columns into place.
ALTER TABLE "access_records"   RENAME COLUMN "id_new" TO "id";
ALTER TABLE "survey_responses" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "survey_responses" RENAME COLUMN "access_record_id_new" TO "access_record_id";

-- 8) New primary keys.
ALTER TABLE "students"         ADD PRIMARY KEY ("numero_control");

ALTER TABLE "access_records"   ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "access_records"   ADD PRIMARY KEY ("id");

ALTER TABLE "survey_responses" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "survey_responses" ADD PRIMARY KEY ("id");

-- 9) New FKs, pointing at numero_control for students and at the UUID PK for
--    access_records. ON UPDATE CASCADE keeps children in sync if an admin ever
--    corrects a numero_control typo.
ALTER TABLE "access_records"
  ALTER COLUMN "numero_control" SET NOT NULL,
  ADD CONSTRAINT "access_records_numero_control_fkey"
    FOREIGN KEY ("numero_control") REFERENCES "students"("numero_control")
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "survey_responses"
  ALTER COLUMN "numero_control"   SET NOT NULL,
  ALTER COLUMN "access_record_id" SET NOT NULL,
  ADD CONSTRAINT "survey_responses_numero_control_fkey"
    FOREIGN KEY ("numero_control") REFERENCES "students"("numero_control")
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT "survey_responses_access_record_id_fkey"
    FOREIGN KEY ("access_record_id") REFERENCES "access_records"("id")
    ON DELETE RESTRICT,
  ADD CONSTRAINT "survey_responses_access_record_id_key"
    UNIQUE ("access_record_id");

COMMIT;
