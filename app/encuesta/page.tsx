"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageWrapper } from "@/components/page-wrapper";
import { StarRating } from "@/components/star-rating";
import { RatingSlider } from "@/components/rating-slider";
import { Confetti } from "@/components/confetti";
import {
  getStudent,
  saveSurvey,
  syncWithServer,
  getLastClosedRecord,
} from "@/lib/idb";

export default function EncuestaPage() {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [limpieza, setLimpieza] = useState(3);
  const [mesas, setMesas] = useState(3);
  const [silencio, setSilencio] = useState(3);
  const [horarioConsulta, setHorarioConsulta] = useState(3);
  const [apoyoAsignaturas, setApoyoAsignaturas] = useState(3);
  const [disponibilidadBibliografia, setDisponibilidadBibliografia] = useState(3);
  const [bibliografiaActualizada, setBibliografiaActualizada] = useState(3);
  const [atencionBusqueda, setAtencionBusqueda] = useState(3);
  const [orientacionEquivalentes, setOrientacionEquivalentes] = useState(3);
  const [disposicionServicio, setDisposicionServicio] = useState(3);
  const [amabilidadAtencion, setAmabilidadAtencion] = useState(3);
  const [relacionAtenta, setRelacionAtenta] = useState(3);
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

  const handleSubmit = async () => {
    setError("");

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
        stars: stars || 3,
        limpieza,
        mesas,
        silencio,
        horarioConsulta,
        apoyoAsignaturas,
        disponibilidadBibliografia,
        bibliografiaActualizada,
        atencionBusqueda,
        orientacionEquivalentes,
        disposicionServicio,
        amabilidadAtencion,
        relacionAtenta,
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

  const handleSkip = () => {
    router.push("/entrada");
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

        <div className="flex flex-col gap-6">
          <RatingSlider
            label="Limpieza del espacio"
            emoji="📚"
            value={limpieza}
            onChange={setLimpieza}
          />
          <RatingSlider
            label="Disponibilidad de mesas"
            emoji="💺"
            value={mesas}
            onChange={setMesas}
          />
          <RatingSlider
            label="Silencio y ambiente"
            emoji="🤫"
            value={silencio}
            onChange={setSilencio}
          />
          <RatingSlider
            label="El horario de consulta es adecuado"
            emoji="🕒"
            value={horarioConsulta}
            onChange={setHorarioConsulta}
          />
          <RatingSlider
            label="La información disponible me apoya en mis asignaturas"
            emoji="📖"
            value={apoyoAsignaturas}
            onChange={setApoyoAsignaturas}
          />
          <RatingSlider
            label="Siempre encuentro al menos un ejemplar de la bibliografía solicitada"
            emoji="📚"
            value={disponibilidadBibliografia}
            onChange={setDisponibilidadBibliografia}
          />
          <RatingSlider
            label="La bibliografía disponible está actualizada"
            emoji="🗂️"
            value={bibliografiaActualizada}
            onChange={setBibliografiaActualizada}
          />
          <RatingSlider
            label="Recibo atención adecuada al buscar un libro"
            emoji="🔎"
            value={atencionBusqueda}
            onChange={setAtencionBusqueda}
          />
          <RatingSlider
            label="Me orientan para encontrar libros equivalentes"
            emoji="🧭"
            value={orientacionEquivalentes}
            onChange={setOrientacionEquivalentes}
          />
          <RatingSlider
            label="Tienen disposición para atenderme cuando solicito un servicio"
            emoji="🙋"
            value={disposicionServicio}
            onChange={setDisposicionServicio}
          />
          <RatingSlider
            label="Me atienden amablemente cuando solicito apoyo"
            emoji="🙂"
            value={amabilidadAtencion}
            onChange={setAmabilidadAtencion}
          />
          <RatingSlider
            label="Mantienen una relación atenta conmigo durante mi estancia"
            emoji="🤝"
            value={relacionAtenta}
            onChange={setRelacionAtenta}
          />
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
          disabled={loading || submitted}
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

        {!submitted && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Omitir encuesta
          </button>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Tu opinión ayuda a mejorar el servicio
        </p>
      </div>
    </PageWrapper>
  );
}
