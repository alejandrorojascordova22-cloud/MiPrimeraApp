import { supabase } from './supabaseClient';

/**
 * Todo lo relacionado con el examen en curso: guardar respuestas,
 * finalizarlo, y la revisión manual de preguntas abiertas.
 * Migrado de la parte "examen" de lib/datos/supabase_service.dart
 */

interface GuardarRespuestaParams {
  idAspirante: number;
  idPregunta: number;
  respuesta: string;
}

/** Guarda o actualiza la respuesta de un aspirante para una pregunta (upsert). */
export async function guardarRespuesta({
  idAspirante,
  idPregunta,
  respuesta,
}: GuardarRespuestaParams): Promise<boolean> {
  const data = {
    aspirante_id: idAspirante,
    pregunta_id: idPregunta,
    respuesta,
    submitted_at: new Date().toISOString(),
    revisado: false,
  };
  try {
    const { error } = await supabase
      .from('respuestas')
      .upsert([data], { onConflict: 'aspirante_id,pregunta_id' });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en guardarRespuesta:', e);
    return false;
  }
}

interface FinalizarExamenParams {
  idAspirante: number;
  aciertos: number;
  total: number;
  calificacion: number;
  estado?: string;
}

/** Registra el cierre formal de una sesión de evaluación para un aspirante. */
export async function finalizarExamen({
  idAspirante,
  aciertos,
  calificacion,
  estado = 'terminado',
}: FinalizarExamenParams): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('aspirantes')
      .update({
        resultado: calificacion,
        aciertos,
        estado,
        examen_finalizado: true,
        hora_fin: new Date().toISOString(),
      })
      .eq('id', idAspirante);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en finalizarExamen:', e);
    return false;
  }
}

/** Obtiene las respuestas de preguntas abiertas pendientes de revisión. */
export async function obtenerRespuestasAbiertas(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('respuestas')
      .select(
        '*, aspirantes(id,nombre,folio,carrera_id,estado), preguntas!inner(id,tipo,pregunta,respuesta_correcta)'
      )
      .eq('preguntas.tipo', 'Abierta')
      .eq('revisado', false)
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerRespuestasAbiertas:', e);
    return [];
  }
}

interface ActualizarRespuestaAbiertaParams {
  revisado?: boolean;
  calificacionManual?: number;
  observaciones?: string;
}

/** Actualiza el estado y calificación manual de una respuesta abierta. */
export async function actualizarRespuestaAbierta(
  respuestaId: number,
  { revisado, calificacionManual, observaciones }: ActualizarRespuestaAbiertaParams
): Promise<boolean> {
  const data: Record<string, any> = {};
  if (revisado !== undefined) data.revisado = revisado;
  if (calificacionManual !== undefined) data.calificacion_manual = calificacionManual;
  if (observaciones !== undefined) data.observaciones = observaciones;
  if (Object.keys(data).length === 0) return false;

  try {
    const { data: res, error } = await supabase
      .from('respuestas')
      .update(data)
      .eq('id', respuestaId)
      .select()
      .maybeSingle();
    if (error) throw error;
    return res != null;
  } catch (e) {
    console.warn('Error en actualizarRespuestaAbierta:', e);
    return false;
  }
}

/**
 * Recalcula el resultado ponderado del aspirante evaluando reactivos
 * de opción múltiple y abiertos (con su calificación manual, si ya existe).
 * Se usa cada vez que un admin revisa/califica una respuesta abierta.
 */
export async function actualizarResultadoAspirantePostRevision(
  idAspirante: number
): Promise<boolean> {
  try {
    const { data: aspirante } = await supabase
      .from('aspirantes')
      .select('id,carrera_id')
      .eq('id', idAspirante)
      .maybeSingle();
    if (!aspirante) return false;

    const carreraId = aspirante.carrera_id;
    if (carreraId == null) return false;

    const { data: respuestasRes, error } = await supabase
      .from('respuestas')
      .select('*, preguntas(tipo,respuesta_correcta)')
      .eq('aspirante_id', idAspirante);
    if (error) throw error;
    const respuestas = respuestasRes ?? [];

    let puntos = 0;
    let totalPreguntas = 0;
    let revisionPendiente = false;

    for (const respuesta of respuestas) {
      const pregunta = respuesta.preguntas;
      if (!pregunta) continue;

      const tipo = pregunta.tipo ?? 'Opción múltiple';
      totalPreguntas++;

      if (tipo === 'Opción múltiple') {
        if (respuesta.respuesta === pregunta.respuesta_correcta) {
          puntos += 1;
        }
      } else {
        const calificacionManual = respuesta.calificacion_manual;
        if (typeof calificacionManual === 'number') {
          puntos += Math.min(Math.max(calificacionManual, 0), 100) / 100;
        } else {
          revisionPendiente = true;
        }
      }
    }

    const resultadoFinal = totalPreguntas === 0 ? 0 : Math.round((puntos / totalPreguntas) * 100);
    const aciertos = Math.round(puntos);
    const nuevoEstado = revisionPendiente ? 'en_revision' : 'terminado';

    const datosActualizar: Record<string, any> = {
      resultado: resultadoFinal,
      aciertos,
      estado: nuevoEstado,
      examen_finalizado: true,
    };

    // Solo se marca la fecha de calificación cuando la revisión ya quedó
    // completa (no en 'en_revision'), y solo la primera vez que se completa,
    // para no ir moviendo la fecha en cada recalculo posterior.
    if (nuevoEstado === 'terminado') {
      const { data: actual } = await supabase
        .from('aspirantes')
        .select('fecha_calificacion')
        .eq('id', idAspirante)
        .maybeSingle();
      if (!actual || actual.fecha_calificacion == null) {
        datosActualizar.fecha_calificacion = new Date().toISOString();
      }
    }

    await supabase.from('aspirantes').update(datosActualizar).eq('id', idAspirante);

    return true;
  } catch (e) {
    console.warn('Error en actualizarResultadoAspirantePostRevision:', e);
    return false;
  }
}
