"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageWrapper } from "@/components/page-wrapper";
import { StarRating } from "@/components/star-rating";
import { RatingChoice } from "@/components/rating-choice";
import { Confetti } from "@/components/confetti";
import {
  getStudent,
  saveSurvey,
  syncWithServer,
  getLastClosedRecord,
} from "@/lib/idb";

const QUESTIONS = [
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

type QuestionKey = (typeof QUESTIONS)[number]["key"];

const INITIAL_ANSWERS: Record<QuestionKey, number> = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, 0])
) as Record<QuestionKey, number>;

export default function EncuestaPage() {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [answers, setAnswers] = useState<Record<QuestionKey, number>>(
    INITIAL_ANSWERS
  );
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRecordId, setLastRecordId] = useState<string | null>(null);
  const [numeroControl, setNumeroControl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function init() {
      const student = await getStudent();
      if (!student) {
        router.replace("/registro");
        return;
      }
      setNumeroControl(student.numeroControl);

      const lastClosed = await getLastClosedRecord();
      if (lastClosed) {
        setLastRecordId(lastClosed.id);
      }
    }
    init();
  }, [router]);

  const allAnswered =
    stars > 0 && QUESTIONS.every((q) => answers[q.key] > 0);

  const handleSubmit = async () => {
    setError("");

    if (!allAnswered) {
      setError("Responde todas las preguntas antes de enviar.");
      return;
    }

    if (!numeroControl || !lastRecordId) {
      setError(
        "No encontramos tu visita más reciente. Intenta regresar e ingresar de nuevo."
      );
      return;
    }

    setLoading(true);

    try {
      await saveSurvey({
        numeroControl,
        accessRecordId: lastRecordId,
        stars,
        ...answers,
        comment: comment.trim(),
      });

      if (navigator.onLine) {
        try {
          await syncWithServer();
        } catch (err) {
          console.warn("Survey sync failed, will retry later:", err);
        }
      }

      setSubmitted(true);
      setTimeout(() => router.push("/entrada"), 3500);
    } catch (err) {
      console.error("Failed to save survey:", err);
      setError("No se pudo guardar la encuesta. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <PageWrapper className="bg-gradient-to-b from-green-50 to-white dark:from-slate-900 dark:to-slate-800">
      {submitted && <Confetti />}

      <div className="px-6 pt-6 pb-2">
        <Badge className="mx-auto flex w-fit gap-1.5 bg-success/10 px-3 py-1.5 text-sm text-success hover:bg-success/10">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Salida registrada
        </Badge>
      </div>

      <h1 className="px-6 pt-4 text-center text-2xl font-bold text-foreground">
        ¡Gracias por usar la biblioteca!
      </h1>

      <div className="flex flex-1 flex-col gap-8 px-6 py-6">
        <StarRating
          value={stars}
          onChange={setStars}
          label="¿Cómo fue tu experiencia?"
        />

        <div className="flex flex-col gap-7">
          {QUESTIONS.map((question) => (
            <RatingChoice
              key={question.key}
              name={question.key}
              label={question.label}
              value={answers[question.key]}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [question.key]: v }))
              }
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="feedback-comment"
            className="text-sm font-medium text-foreground"
          >
            ¿Qué podemos mejorar?
          </label>
          <Textarea
            id="feedback-comment"
            placeholder="Tu opinión es valiosa... (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || submitted || !allAnswered}
          aria-busy={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-success p-4 text-xl font-bold text-success-foreground shadow-lg transition-all duration-300 hover:bg-success/90 active:scale-95 focus-visible:ring-4 focus-visible:ring-success/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? (
            <span className="size-6 animate-spin rounded-full border-2 border-success-foreground border-t-transparent" />
          ) : submitted ? (
            <>
              <CheckCircle2 className="size-6" aria-hidden="true" />
              ¡Enviado!
            </>
          ) : (
            <>
              <Send className="size-6" aria-hidden="true" />
              ENVIAR Y TERMINAR
            </>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Responde todas las preguntas para continuar. Tu opinión ayuda a
          mejorar el servicio
        </p>
      </div>
    </PageWrapper>
  );
}
