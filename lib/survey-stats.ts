export const SURVEY_QUESTIONS = [
  { key: "stars", label: "Experiencia general" },
  { key: "limpieza", label: "Limpieza del espacio" },
  { key: "mesas", label: "Disponibilidad de mesas" },
  { key: "silencio", label: "Silencio y ambiente" },
  { key: "horarioConsulta", label: "El horario de consulta es adecuado" },
  {
    key: "apoyoAsignaturas",
    label: "La información disponible me apoya en mis asignaturas",
  },
  {
    key: "disponibilidadBibliografia",
    label: "Encuentro al menos un ejemplar de la bibliografía solicitada",
  },
  {
    key: "bibliografiaActualizada",
    label: "La bibliografía disponible está actualizada",
  },
  {
    key: "atencionBusqueda",
    label: "Recibo atención adecuada al buscar un libro",
  },
  {
    key: "orientacionEquivalentes",
    label: "Me orientan para encontrar libros equivalentes",
  },
  {
    key: "disposicionServicio",
    label: "Tienen disposición para atenderme cuando solicito un servicio",
  },
  {
    key: "amabilidadAtencion",
    label: "Me atienden amablemente cuando solicito apoyo",
  },
] as const;

export type SurveyQuestionKey = (typeof SURVEY_QUESTIONS)[number]["key"];

export type SurveyAnswers = Record<SurveyQuestionKey, number | null>;

export const SURVEY_ANSWER_SELECT = Object.fromEntries(
  SURVEY_QUESTIONS.map(({ key }) => [key, true])
) as Record<SurveyQuestionKey, true>;

export interface SurveyQuestionSummary {
  key: string;
  label: string;
  average: number | null;
  responses: number;
}

export interface SurveySummary {
  from: string | null;
  to: string | null;
  sampleSize: number;
  questions: SurveyQuestionSummary[];
}

export function buildSurveySummary(
  responses: SurveyAnswers[],
  from: string | null,
  to: string | null
): SurveySummary {
  const questions = SURVEY_QUESTIONS.map(({ key, label }) => {
    const values = responses
      .map((response) => response[key])
      .filter((value): value is number => value !== null);
    return {
      key,
      label,
      average:
        values.length > 0
          ? Math.round(
              (values.reduce((sum, value) => sum + value, 0) / values.length) *
                100
            ) / 100
          : null,
      responses: values.length,
    };
  });

  return { from, to, sampleSize: responses.length, questions };
}
