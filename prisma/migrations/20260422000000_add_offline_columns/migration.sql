-- Migration A: expand (additive, backward-compatible with old client).
-- Adds the `devices` table, new offline-first columns on every business table,
-- a generic `set_updated_at` trigger, and RLS on `devices`.
-- No existing columns are dropped or renamed in this step.

BEGIN;

-- Enum for Device.platform
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android', 'desktop', 'unknown');

-- devices: one row per installed PWA instance.
CREATE TABLE "devices" (
  "id"             UUID             PRIMARY KEY,
  "platform"       "DevicePlatform" NOT NULL DEFAULT 'unknown',
  "user_agent"     TEXT,
  "first_seen_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "last_seen_at"   TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "created_at"     TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ      NOT NULL DEFAULT now()
);

ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;

-- students: add current_device_id + updated_at.
-- (We keep the existing `id` and `device_id` columns untouched in this
--  migration so the old client keeps working between A and C.)
ALTER TABLE "students"
  ADD COLUMN "current_device_id" UUID REFERENCES "devices"("id") ON DELETE SET NULL,
  ADD COLUMN "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now();

-- access_records: new columns for offline-first auditing and the numero_control
-- FK that will eventually replace student_id. All nullable in this migration;
-- migration B fills them and D enforces NOT NULL.
ALTER TABLE "access_records"
  ADD COLUMN "numero_control"     TEXT,
  ADD COLUMN "source_device_id"   UUID REFERENCES "devices"("id") ON DELETE RESTRICT,
  ADD COLUMN "client_recorded_at" TIMESTAMPTZ,
  ADD COLUMN "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now();

-- Normalize synced_at (currently nullable in the initial schema).
UPDATE "access_records" SET "synced_at" = "created_at" WHERE "synced_at" IS NULL;
ALTER TABLE "access_records" ALTER COLUMN "synced_at" SET DEFAULT now();
ALTER TABLE "access_records" ALTER COLUMN "synced_at" SET NOT NULL;

-- survey_responses: new offline-first columns.
ALTER TABLE "survey_responses"
  ADD COLUMN "numero_control"     TEXT,
  ADD COLUMN "source_device_id"   UUID REFERENCES "devices"("id") ON DELETE RESTRICT,
  ADD COLUMN "client_recorded_at" TIMESTAMPTZ,
  ADD COLUMN "synced_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now();

-- admin_users: updated_at.
ALTER TABLE "admin_users"
  ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Generic updated_at trigger function.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON "students"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON "devices"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_access_records_updated_at
  BEFORE UPDATE ON "access_records"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_survey_responses_updated_at
  BEFORE UPDATE ON "survey_responses"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON "admin_users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
