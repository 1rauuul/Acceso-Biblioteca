BEGIN;

ALTER TABLE "survey_responses"
  ADD COLUMN "horario_consulta" SMALLINT,
  ADD COLUMN "apoyo_asignaturas" SMALLINT,
  ADD COLUMN "disponibilidad_bibliografia" SMALLINT,
  ADD COLUMN "bibliografia_actualizada" SMALLINT,
  ADD COLUMN "atencion_busqueda" SMALLINT,
  ADD COLUMN "orientacion_equivalentes" SMALLINT,
  ADD COLUMN "disposicion_servicio" SMALLINT,
  ADD COLUMN "amabilidad_atencion" SMALLINT,
  ADD COLUMN "relacion_atenta" SMALLINT;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_horario_consulta_range_chk"
    CHECK ("horario_consulta" IS NULL OR "horario_consulta" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_apoyo_asignaturas_range_chk"
    CHECK ("apoyo_asignaturas" IS NULL OR "apoyo_asignaturas" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_disponibilidad_bibliografia_range_chk"
    CHECK ("disponibilidad_bibliografia" IS NULL OR "disponibilidad_bibliografia" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_bibliografia_actualizada_range_chk"
    CHECK ("bibliografia_actualizada" IS NULL OR "bibliografia_actualizada" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_atencion_busqueda_range_chk"
    CHECK ("atencion_busqueda" IS NULL OR "atencion_busqueda" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_orientacion_equivalentes_range_chk"
    CHECK ("orientacion_equivalentes" IS NULL OR "orientacion_equivalentes" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_disposicion_servicio_range_chk"
    CHECK ("disposicion_servicio" IS NULL OR "disposicion_servicio" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_amabilidad_atencion_range_chk"
    CHECK ("amabilidad_atencion" IS NULL OR "amabilidad_atencion" BETWEEN 1 AND 5),
  ADD CONSTRAINT "survey_responses_relacion_atenta_range_chk"
    CHECK ("relacion_atenta" IS NULL OR "relacion_atenta" BETWEEN 1 AND 5);

COMMIT;