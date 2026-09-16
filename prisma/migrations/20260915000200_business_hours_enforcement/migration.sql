-- RN-02 + RN-03: business-hours enforcement in the database-side safety net.
--
-- 1) Reschedule the pg_cron job from 00:05 UTC (18:05 MX) to 00:03 UTC
--    (18:03 MX), matching the Vercel Cron in vercel.json.
-- 2) Cap the backfilled exit_time at entry_time + 3 hours (RN-03), so a
--    forgotten open session never records more than the maximum allowed
--    duration, even when the per-student average is longer.
--
-- Idempotent: recreates the function and unschedules any previous job.
-- Mirrors the SQL in app/api/cron/auto-close/route.ts.

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_close_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_close TIMESTAMPTZ;
  updated_rows INTEGER;
BEGIN
  today_close := date_trunc('day', now() AT TIME ZONE 'America/Mexico_City')
               + INTERVAL '18 hours';
  today_close := today_close AT TIME ZONE 'America/Mexico_City';

  WITH closed AS (
    UPDATE "access_records" ar
    SET
      "exit_time"   = LEAST(
        GREATEST(
          ar."entry_time",
          ar."entry_time" + COALESCE((
            SELECT ROUND(AVG(h."duration_minutes"))::int
            FROM (
              SELECT "duration_minutes"
              FROM "access_records"
              WHERE "numero_control" = ar."numero_control"
                AND "duration_minutes" IS NOT NULL
                AND "auto_closed" = false
              ORDER BY "entry_time" DESC
              LIMIT 20
            ) h
          ), 120) * INTERVAL '1 minute'
        ),
        ar."entry_time" + INTERVAL '180 minutes',
        today_close
      ),
      "auto_closed" = true
    WHERE ar."exit_time" IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_rows FROM closed;

  RETURN updated_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_close_sessions() FROM PUBLIC;

DO $$
DECLARE
  prev_jobid BIGINT;
BEGIN
  SELECT jobid INTO prev_jobid
  FROM cron.job
  WHERE jobname = 'library-auto-close';
  IF prev_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(prev_jobid);
  END IF;
END;
$$;

-- Schedule: every day at 00:03 UTC (== 18:03 Mexico City year-round;
-- Mexico doesn't observe DST since 2022).
SELECT cron.schedule(
  'library-auto-close',
  '3 0 * * *',
  $$SELECT public.auto_close_sessions();$$
);

COMMIT;
