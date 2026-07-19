/**
 * Lógica de negocio del examen, separada de la UI.
 * Migrado de lib/dominio/examen_controlador.dart
 */

/**
 * Compara las respuestas del alumno con las correctas y cuenta los aciertos.
 * Solo autocalifica las de opción múltiple. Las demás quedan para revisión manual.
 */
export function calcularAciertos(
  preguntas: Record<string, any>[],
  respuestas: (string | null)[]
): number {
  let aciertos = 0;
  for (let i = 0; i < preguntas.length; i++) {
    const tipo = preguntas[i].tipo ?? 'Opción múltiple';
    if (tipo === 'Opción múltiple') {
      if (respuestas[i] != null && respuestas[i] === preguntas[i].respuesta_correcta) {
        aciertos++;
      }
    }
    // Otros tipos (Abierta, Imagen, Audio) no suman puntos aquí; se suman en revisión manual.
  }
  return aciertos;
}

/** Calcula el porcentaje de 0 a 100. */
export function calcularCalificacion(aciertos: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((aciertos / total) * 100);
}

/** Devuelve un mensaje motivador según el desempeño. */
export function obtenerMensajeFeedback(calificacion: number): string {
  if (calificacion >= 90) return '¡Excelente desempeño! Eres un candidato destacado.';
  if (calificacion >= 70) return '¡Buen trabajo! Has aprobado satisfactoriamente.';
  return 'Examen finalizado. El área de Vinculación revisará tu proceso.';
}
