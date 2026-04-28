BEGIN;

-- Guard: fail fast if there are students with invalid control numbers.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "students"
    WHERE "numero_control" !~ '^\d{8}$'
  ) THEN
    RAISE EXCEPTION
      'Migration aborted: found students.numero_control not matching exactly 8 digits';
  END IF;
END $$;

ALTER TABLE "students"
  DROP CONSTRAINT IF EXISTS "students_numero_control_format_chk",
  ADD CONSTRAINT "students_numero_control_format_chk"
    CHECK ("numero_control" ~ '^\d{8}$');

COMMIT;
