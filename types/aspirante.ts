/**
 * Entidades del dominio para el aspirante y las preguntas.
 * Migrado de lib/dominio/aspirante.dart
 */

export type EstadoAspirante =
  | "pendiente"
  | "en_progreso"
  | "en_revision"
  | "terminado";

export interface Aspirante {
  id: number;
  nombre: string;
  folio: string;
  correo: string;
  carreraId: number;
  carreraNombre: string;
  estado: EstadoAspirante;
  asistencia: boolean;
  resultado: number | null; // calificación final 0-100, null si aún no disponible
  aciertos: number | null; // número de respuestas correctas, null si aún no disponible
  modo_calificacion: "inmediato" | "programado";
  fecha_publicacion_calificacion: string | null;
  fecha_inicio_examen: string | null;
  fecha_fin_examen: string | null;
}

/** Intenta convertir cualquier valor a número entero; regresa 0 si falla. */
function aEntero(valor: unknown, porDefecto = 0): number {
  const n = parseInt(String(valor ?? ""), 10);
  return Number.isNaN(n) ? porDefecto : n;
}

function extraerCarrera(mapa: Record<string, any>): string {
  if (mapa.carrera_nombre != null) return String(mapa.carrera_nombre);
  if (mapa.carrera != null) return String(mapa.carrera);
  if (mapa.carreras != null) {
    if (Array.isArray(mapa.carreras)) {
      return mapa.carreras[0]?.nombre ?? "Sin carrera";
    }
    if (typeof mapa.carreras === "object") {
      return mapa.carreras.nombre ?? "Sin carrera";
    }
  }
  return "Carrera no asignada";
}

/** Convierte una fila cruda de Supabase (snake_case) a un objeto Aspirante. */
export function aspiranteFromMap(mapa: Record<string, any>): Aspirante {
  return {
    id: aEntero(mapa.id),
    nombre: mapa.nombre?.toString() ?? "Sin nombre",
    folio: mapa.folio?.toString() ?? "",
    correo: mapa.correo?.toString() ?? "",
    carreraId: aEntero(mapa.carrera_id),
    carreraNombre: extraerCarrera(mapa),
    estado: (mapa.estado?.toString() as EstadoAspirante) ?? "pendiente",
    asistencia: mapa.asistencia === true || mapa.asistencia?.toString() === "1",
    resultado: mapa.resultado != null ? aEntero(mapa.resultado) : null,
    aciertos: mapa.aciertos != null ? aEntero(mapa.aciertos) : null,
    modo_calificacion:
      (mapa.modo_calificacion as "inmediato" | "programado") ?? "inmediato",
    fecha_publicacion_calificacion: mapa.fecha_publicacion_calificacion ?? null,
    fecha_inicio_examen: mapa.fecha_inicio_examen ?? null,
    fecha_fin_examen: mapa.fecha_fin_examen ?? null,
  };
}

/** Convierte un Aspirante de vuelta al formato snake_case que espera Supabase. */
export function aspiranteToMap(a: Aspirante): Record<string, any> {
  return {
    id: a.id,
    nombre: a.nombre,
    folio: a.folio,
    correo: a.correo,
    carrera_id: a.carreraId,
    carrera_nombre: a.carreraNombre,
    estado: a.estado,
    asistencia: a.asistencia,
    resultado: a.resultado,
    aciertos: a.aciertos,
    fecha_inicio_examen: a.fecha_inicio_examen,
    fecha_fin_examen: a.fecha_fin_examen,
  };
}

/** Igual que copiarCon() en Dart: regresa un aspirante nuevo con los campos cambiados. */
export function copiarConAspirante(
  base: Aspirante,
  cambios: Partial<
    Pick<Aspirante, "estado" | "asistencia" | "resultado" | "aciertos">
  >,
): Aspirante {
  return { ...base, ...cambios };
}

export interface Pregunta {
  id: number;
  carreraId: number;
  materia: string;
  textoPregunta: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  respuestaCorrecta: string;
}

export function preguntaDesdeJson(json: Record<string, any>): Pregunta {
  return {
    id: aEntero(json.id),
    carreraId: aEntero(json.carrera_id),
    materia: json.materia?.toString() ?? "",
    textoPregunta: json.pregunta?.toString() ?? "",
    opcionA: json.opcion_a?.toString() ?? "",
    opcionB: json.opcion_b?.toString() ?? "",
    opcionC: json.opcion_c?.toString() ?? "",
    opcionD: json.opcion_d?.toString() ?? "",
    respuestaCorrecta: json.respuesta_correcta?.toString() ?? "A",
  };
}

export function preguntaEsCorrecta(
  pregunta: Pregunta,
  respuesta: string | null | undefined,
): boolean {
  return (
    (respuesta?.toUpperCase() ?? "") ===
    pregunta.respuestaCorrecta.toUpperCase()
  );
}
