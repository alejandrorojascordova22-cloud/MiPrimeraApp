import type { ActividadCronograma } from "@/services/cronogramaServicio";
import { Ionicons } from "@expo/vector-icons";

/**
 * Ícono automático según palabras clave del título de la actividad, para
 * que cada una se distinga visualmente de un vistazo en vez de verse
 * todas iguales (antes solo había un punto de color). Se usa tanto en la
 * vista del administrador como en la del aspirante.
 */
export function iconoPorActividad(
  titulo: string,
): keyof typeof Ionicons.glyphMap {
  const t = titulo.toLowerCase();
  if (/examen|evaluaci[oó]n|prueba/.test(t)) return "document-text-outline";
  if (/registro|inscripci[oó]n|convocatoria/.test(t))
    return "person-add-outline";
  if (/resultado|calificaci[oó]n|publicaci[oó]n/.test(t))
    return "trophy-outline";
  if (/entrevista/.test(t)) return "chatbubbles-outline";
  if (/pago|cuota|inscrito/.test(t)) return "cash-outline";
  if (/cierre|fin\b|termina/.test(t)) return "flag-outline";
  if (/inicio|apertura|abre/.test(t)) return "flag-outline";
  return "calendar-outline";
}

export type EstadoActividad = "pasado" | "hoy" | "en_curso" | "proximo";

/** Calcula si una actividad ya pasó, es hoy, está en curso o es futura. */
export function estadoDeActividad(
  actividad: ActividadCronograma,
): EstadoActividad {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicio = new Date(actividad.fecha_inicio);
  inicio.setHours(0, 0, 0, 0);
  const fin = actividad.fecha_fin ? new Date(actividad.fecha_fin) : inicio;
  fin.setHours(0, 0, 0, 0);

  if (hoy.getTime() === inicio.getTime()) return "hoy";
  if (hoy > inicio && hoy <= fin) return "en_curso";
  if (hoy > fin) return "pasado";
  return "proximo";
}

export const ETIQUETA_ESTADO_ACTIVIDAD: Record<
  EstadoActividad,
  { texto: string; color: string }
> = {
  pasado: { texto: "Pasado", color: "#94A3B8" },
  hoy: { texto: "Hoy", color: "#DC2626" },
  en_curso: { texto: "En curso", color: "#16A34A" },
  proximo: { texto: "Próximo", color: "#7C3AED" },
};
