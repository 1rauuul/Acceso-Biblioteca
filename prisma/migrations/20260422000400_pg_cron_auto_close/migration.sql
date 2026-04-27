-- Migration E (OPTIONAL, idempotent safety net).
-- Installs a SECURITY DEFINER function `auto_close_sessions()` that replicates
-- the Vercel cron's behavior and schedules it via pg_cron at 00:05 UTC
-- (== 18:05 Mexico City, immediately after the library closes).
--
-- Why redundant? If Vercel Cron is misconfigured, paused, or the serverless
-- function is cold-erroring, sessions would linger as "dentro" for ~24h.
-- A database-native cron removes that failure mode at essentially zero cost.
--
-- Skip this migration (or drop it) if the Supabase project doesn't have the
-- `pg_cron` extension available (free-tier projects do not). The rest of the
-- app keeps working without it.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The function closes every open session with the smaller of
--   (entry_time + per-student avg of last 20 completed visits, fallback 120min)
--   vs today's closing time at 18:00 America/Mexico_City.
-- `duration_minutes` is a GENERATED STORED column, recomputed automatically.
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

-- Only the postgres role can invoke the function directly.
REVOKE ALL ON FUNCTION public.auto_close_sessions() FROM PUBLIC;

-- Schedule: every day at 00:05 UTC (== 18:05 Mexico City year-round;
-- Mexico doesn't observe DST in most of the country since 2022).
-- Unschedule any previous version so the migration is idempotent.
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

SELECT cron.schedule(
  'library-auto-close',
  '5 0 * * *',
  $$SELECT public.auto_close_sessions();$$
);

COMMIT;
