-- Migration D: contract. Finalize types, constraints and indices.
-- After this migration the schema matches prisma/schema.prisma exactly.

BEGIN;

-- 1) TIMESTAMP(3) → TIMESTAMPTZ (treat existing values as UTC, which matches
--    how the app wrote them via `new Date().toISOString()`).
ALTER TABLE "students"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "access_records"
  ALTER COLUMN "entry_time" TYPE TIMESTAMPTZ USING "entry_time" AT TIME ZONE 'UTC',
  ALTER COLUMN "exit_time"  TYPE TIMESTAMPTZ USING "exit_time"  AT TIME ZONE 'UTC',
  ALTER COLUMN "synced_at"  TYPE TIMESTAMPTZ USING "synced_at"  AT TIME ZONE 'UTC';

ALTER TABLE "survey_responses"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "admin_users"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC';

-- 2) Enforce NOT NULL on the offline columns now that they've been backfilled.
ALTER TABLE "access_records"
  ALTER COLUMN "numero_control"     SET NOT NULL,
  ALTER COLUMN "source_device_id"   SET NOT NULL,
  ALTER COLUMN "client_recorded_at" SET NOT NULL;

ALTER TABLE "survey_responses"
  ALTER COLUMN "numero_control"     SET NOT NULL,
  ALTER COLUMN "source_device_id"   SET NOT NULL,
  ALTER COLUMN "client_recorded_at" SET NOT NULL;

-- 3) Narrow semestre from INTEGER to SMALLINT to match the Prisma schema
--    (and cheapen the index).
ALTER TABLE "students"
  ALTER COLUMN "semestre" TYPE SMALLINT USING "semestre"::smallint;

ALTER TABLE "survey_responses"
  ALTER COLUMN "stars"    TYPE SMALLINT USING "stars"::smallint,
  ALTER COLUMN "limpieza" TYPE SMALLINT USING "limpieza"::smallint,
  ALTER COLUMN "mesas"    TYPE SMALLINT USING "mesas"::smallint,
  ALTER COLUMN "silencio" TYPE SMALLINT USING "silencio"::smallint;

-- 4) duration_minutes → GENERATED ALWAYS AS STORED.
--    We must drop + re-add because ALTER COLUMN cannot turn an ordinary
--    column into a generated one.
ALTER TABLE "access_records" DROP COLUMN "duration_minutes";
ALTER TABLE "access_records" ADD COLUMN "duration_minutes" INTEGER
  GENERATED ALWAYS AS (
    CASE
      WHEN "exit_time" IS NULL THEN NULL
      ELSE GREATEST(
        0,
        (EXTRACT(EPOCH FROM ("exit_time" - "entry_time")) / 60)::int
      )
    END
  ) STORED;

-- 5) CHECK constraints.
ALTER TABLE "students"
  ADD CONSTRAINT "students_numero_control_format_chk"
    CHECK ("numero_control" ~ '^[A-Za-z0-9-]{4,20}$'),
  ADD CONSTRAINT "students_semestre_range_chk"
    CHECK ("semestre" BETWEEN 1 AND 12);

ALTER TABLE "access_records"
  ADD CONSTRAINT "access_records_exit_after_entry_chk"
    CHECK ("exit_time" IS NULL OR "exit_time" >= "entry_time");

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_stars_range_chk"    CHECK ("stars"    BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_limpieza_range_chk" CHECK ("limpieza" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_mesas_range_chk"    CHECK ("mesas"    BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_silencio_range_chk" CHECK ("silencio" BETWEEN 1 AND 5);

-- 6) Indices matching prisma/schema.prisma, plus a partial index that
--    accelerates the "open sessions" scan used by /api/sync and the cron.
CREATE INDEX IF NOT EXISTS "access_records_numero_control_entry_time_idx"
  ON "access_records" ("numero_control", "entry_time" DESC);

CREATE INDEX IF NOT EXISTS "access_records_updated_at_idx"
  ON "access_records" ("updated_at");

CREATE INDEX IF NOT EXISTS "access_records_source_device_id_idx"
  ON "access_records" ("source_device_id");

CREATE INDEX IF NOT EXISTS "access_records_open_sessions_idx"
  ON "access_records" ("numero_control") WHERE "exit_time" IS NULL;

CREATE INDEX IF NOT EXISTS "survey_responses_numero_control_created_at_idx"
  ON "survey_responses" ("numero_control", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "survey_responses_updated_at_idx"
  ON "survey_responses" ("updated_at");

CREATE INDEX IF NOT EXISTS "devices_last_seen_at_idx"
  ON "devices" ("last_seen_at" DESC);

-- 7) admin_users.id: migrate TEXT cuid → UUID (keeping existing hashes stable
--    where possible). If the stored id is already a UUID we preserve it;
--    otherwise we allocate a new one. This is safe because nothing references
--    admin_users.id as an FK.
ALTER TABLE "admin_users" ADD COLUMN "id_new" UUID;
UPDATE "admin_users"
SET "id_new" = CASE
  WHEN "id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN "id"::uuid
  ELSE gen_random_uuid()
END;
ALTER TABLE "admin_users" DROP CONSTRAINT "admin_users_pkey";
ALTER TABLE "admin_users" DROP COLUMN "id";
ALTER TABLE "admin_users" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "admin_users" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "admin_users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "admin_users" ADD PRIMARY KEY ("id");

COMMIT;
