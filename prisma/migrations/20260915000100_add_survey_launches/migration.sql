BEGIN;

-- One row per "Lanzar encuesta" action by an admin. The active campaign is
-- the most recent row; students must answer once per launch.
CREATE TABLE "survey_launches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "launched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "survey_launches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_launches_launched_at_idx" ON "survey_launches"("launched_at" DESC);

ALTER TABLE "public"."survey_launches" ENABLE ROW LEVEL SECURITY;

COMMIT;
