import { supabase } from './supabaseClient';

/**
 * Todo lo relacionado con preguntas y "exámenes" (bloques de preguntas
 * vinculados a una o varias carreras). Usado por gestionar-preguntas.tsx,
 * examen.tsx y seleccion-carrera.tsx.
 * Migrado de la parte "preguntas/examenes" de lib/datos/supabase_service.dart
 */

const SELECT_PREGUNTA_CON_EXAMEN =
  '*, examenes(materia, seccion, duracion_examen, bloqueo_capturas, ' +
  'bloqueo_navegacion, color_fondo, color_texto, tamano_fuente, ' +
  'interlineado, margen_izquierdo, alineacion, ' +
  'examen_carrera(carrera_id, carreras(nombre)))';

/**
 * Convierte una fila de "preguntas" (con el join a examenes/examen_carrera)
 * en un objeto plano donde materia/seccion/carreras quedan accesibles
 * directamente, para no romper el código que ya consumía esos campos.
 */
function aplanarPreguntaConExamen(item: Record<string, any>): Record<string, any> {
  const m = { ...item };
  const examen = m.examenes;
  if (examen && typeof examen === 'object') {
    m.materia = examen.materia;
    m.seccion = examen.seccion;
    m.duracion_examen = examen.duracion_examen;
    m.bloqueo_capturas = examen.bloqueo_capturas;
    m.bloqueo_navegacion = examen.bloqueo_navegacion;
    m.color_fondo = examen.color_fondo;
    m.color_texto = examen.color_texto;
    m.tamano_fuente = examen.tamano_fuente;
    m.interlineado = examen.interlineado;
    m.margen_izquierdo = examen.margen_izquierdo;
    m.alineacion = examen.alineacion;

    const ec = examen.examen_carrera;
    if (Array.isArray(ec)) {
      m.carreras = ec.map((e: any) => ({
        id: e?.carrera_id ?? null,
        nombre: e?.carreras?.nombre ?? 'Desconocida',
      }));
      // Compatibilidad con código antiguo que esperaba un solo carrera_id:
      // se deja el primero solo como referencia rápida, NO como fuente de verdad.
      if (m.carreras.length > 0) {
        m.carrera_id = m.carreras[0].id;
      }
    }
  }
  return m;
}

/**
 * Si Supabase responde PGRST204 ("Could not find the 'x' column of
 * 'y' in the schema cache") extrae el nombre de esa columna. Pasa esto
 * cuando la tabla real en Supabase todavía no tiene una columna que el
 * código sí está mandando (falta correr un ALTER TABLE, o el schema
 * cache de PostgREST no se ha refrescado).
 */
function columnaFaltante(error: any): string | null {
  if (!error) return null;
  const mensaje = String(error.message ?? '');
  const match = mensaje.match(/Could not find the '([^']+)' column/);
  if (match && (error.code === 'PGRST204' || mensaje.includes('PGRST204'))) {
    return match[1];
  }
  return null;
}

/**
 * Obtiene las preguntas visibles para una carrera específica, recorriendo
 * examen_carrera -> examenes -> preguntas (relación muchos a muchos real).
 */
export async function obtenerPreguntas(idCarrera: number): Promise<Record<string, any>[]> {
  try {
    const { data: examenIdsRes, error: e1 } = await supabase
      .from('examen_carrera')
      .select('examen_id')
      .eq('carrera_id', idCarrera);
    if (e1) throw e1;

    const examenIds = (examenIdsRes ?? []).map((e) => e.examen_id as number);
    if (examenIds.length === 0) return [];

    const { data, error } = await supabase
      .from('preguntas')
      .select(SELECT_PREGUNTA_CON_EXAMEN)
      .in('examen_id', examenIds)
      .order('id', { ascending: true });
    if (error) throw error;

    return (data ?? []).map(aplanarPreguntaConExamen);
  } catch (e) {
    console.warn('Error en obtenerPreguntas:', e);
    return [];
  }
}

/**
 * Obtiene todas las preguntas, con su materia/sección/carreras ya
 * aplanadas desde el examen al que pertenecen.
 */
export async function obtenerTodasPreguntas(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('preguntas')
      .select(SELECT_PREGUNTA_CON_EXAMEN)
      .order('id', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(aplanarPreguntaConExamen);
  } catch (e) {
    console.warn('Error en obtenerTodasPreguntas:', e);
    return [];
  }
}

/** Agrega una nueva pregunta suelta (ya debe incluir 'examen_id'). */
export async function agregarPregunta(
  pregunta: Record<string, any>
): Promise<Record<string, any> | null> {
  try {
    const { data: res, error } = await supabase
      .from('preguntas')
      .insert(pregunta)
      .select()
      .maybeSingle();
    if (error) throw error;
    return res ?? null;
  } catch (e) {
    console.warn('Error en agregarPregunta:', e);
    return null;
  }
}

/** Actualiza una pregunta existente mediante su ID. */
export async function actualizarPregunta(
  id: number,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const { data: res, error } = await supabase
      .from('preguntas')
      .update(data)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return res != null;
  } catch (e) {
    console.warn('Error en actualizarPregunta:', e);
    return false;
  }
}

/** Elimina una pregunta permanentemente por su ID. */
export async function eliminarPregunta(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from('preguntas').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en eliminarPregunta:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// Gestión de "examenes" (bloques) y su relación con carreras
// ─────────────────────────────────────────────────────────────────

/**
 * Crea el examen (bloque) y devuelve la fila con su id generado.
 *
 * Si Supabase rechaza la petición porque una columna del payload no existe
 * todavía en la tabla `examenes` (error PGRST204 — típico cuando se agregó
 * un campo nuevo en el código pero falta la migración en la base de datos),
 * se reintenta automáticamente sin esa columna en vez de fallar por
 * completo. Así el examen se sigue guardando con el resto de los datos, y
 * en el log queda claro qué columna falta agregar en Supabase.
 */
export async function crearExamen(
  datosExamen: Record<string, any>
): Promise<Record<string, any> | null> {
  const datos = { ...datosExamen };
  try {
    const { data: res, error } = await supabase.from('examenes').insert(datos).select().maybeSingle();
    if (error) throw error;
    return res ?? null;
  } catch (e) {
    const columna = columnaFaltante(e);
    if (columna != null && columna in datos) {
      console.warn(
        `crearExamen: la columna "${columna}" no existe en la tabla ` +
          '"examenes" de Supabase (falta agregarla ahí). Reintentando ' +
          'sin esa columna para no perder el resto de los datos...'
      );
      delete datos[columna];
      return crearExamen(datos);
    }
    console.warn('Error en crearExamen:', e);
    return null;
  }
}

/**
 * Actualiza los datos generales del examen (materia, tiempos, formato, etc.).
 * Mismo mecanismo de auto-reintento que crearExamen ante columnas que aún
 * no existen en la tabla `examenes`.
 */
export async function actualizarExamen(
  id: number,
  datosOriginales: Record<string, any>
): Promise<boolean> {
  const datos = { ...datosOriginales };
  try {
    const { data: res, error } = await supabase
      .from('examenes')
      .update(datos)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return res != null;
  } catch (e) {
    const columna = columnaFaltante(e);
    if (columna != null && columna in datos) {
      console.warn(
        `actualizarExamen: la columna "${columna}" no existe en la tabla ` +
          '"examenes" de Supabase (falta agregarla ahí). Reintentando ' +
          'sin esa columna para no perder el resto de los datos...'
      );
      delete datos[columna];
      return actualizarExamen(id, datos);
    }
    console.warn('Error en actualizarExamen:', e);
    return false;
  }
}

/**
 * Elimina un examen completo (sus preguntas y vínculos se borran en
 * cascada gracias a las FK "on delete cascade").
 */
export async function eliminarExamen(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from('examenes').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en eliminarExamen:', e);
    return false;
  }
}

/**
 * Reemplaza por completo el conjunto de carreras vinculadas a un examen:
 * borra las relaciones previas y crea las nuevas. Así, seleccionar varias
 * carreras SÍ deja el examen visible en todas ellas.
 */
export async function vincularCarrerasAExamen(
  examenId: number,
  carreraIds: number[]
): Promise<boolean> {
  try {
    await supabase.from('examen_carrera').delete().eq('examen_id', examenId);
    if (carreraIds.length === 0) return true;
    const { error } = await supabase
      .from('examen_carrera')
      .insert(carreraIds.map((cid) => ({ examen_id: examenId, carrera_id: cid })));
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en vincularCarrerasAExamen:', e);
    return false;
  }
}

/** Inserta varias preguntas de una sola vez (todas deben traer 'examen_id'). */
export async function agregarPreguntasBloque(
  preguntas: Record<string, any>[]
): Promise<boolean> {
  try {
    if (preguntas.length === 0) return true;
    const { error } = await supabase.from('preguntas').insert(preguntas);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en agregarPreguntasBloque:', e);
    return false;
  }
}

/**
 * Reemplaza TODAS las preguntas de un examen: borra las anteriores y
 * guarda las nuevas. Útil al editar un bloque completo desde cero.
 */
export async function reemplazarPreguntasDeExamen(
  examenId: number,
  preguntas: Record<string, any>[]
): Promise<boolean> {
  try {
    await supabase.from('preguntas').delete().eq('examen_id', examenId);
    if (preguntas.length === 0) return true;
    const { error } = await supabase
      .from('preguntas')
      .insert(preguntas.map((p) => ({ ...p, examen_id: examenId })));
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en reemplazarPreguntasDeExamen:', e);
    return false;
  }
}

/**
 * Lista de exámenes para el historial: cada examen con su conteo de
 * preguntas y las carreras a las que está vinculado.
 */
export async function obtenerExamenes(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('examenes')
      .select('*, preguntas(id), examen_carrera(carrera_id, carreras(nombre))')
      .order('id', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((item: any) => {
      const m = { ...item };
      m.total_preguntas = Array.isArray(m.preguntas) ? m.preguntas.length : 0;
      const ec = m.examen_carrera;
      m.carreras = Array.isArray(ec)
        ? ec.map((e: any) => ({
            id: e?.carrera_id ?? null,
            nombre: e?.carreras?.nombre ?? 'Desconocida',
          }))
        : [];
      return m;
    });
  } catch (e) {
    console.warn('Error en obtenerExamenes:', e);
    return [];
  }
}

/**
 * Obtiene un examen puntual con sus carreras vinculadas (para abrirlo en
 * el editor de bloque).
 */
export async function obtenerExamenPorId(id: number): Promise<Record<string, any> | null> {
  try {
    const { data: res, error } = await supabase
      .from('examenes')
      .select('*, examen_carrera(carrera_id)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!res) return null;

    const m = { ...res };
    const ec = m.examen_carrera;
    m.carrera_ids = Array.isArray(ec) ? ec.map((e: any) => e.carrera_id as number) : [];
    return m;
  } catch (e) {
    console.warn('Error en obtenerExamenPorId:', e);
    return null;
  }
}

/**
 * Preguntas de un examen puntual (para abrirlo en el editor o en el
 * detalle del historial).
 */
export async function obtenerPreguntasPorExamen(
  examenId: number
): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('preguntas')
      .select()
      .eq('examen_id', examenId)
      .order('id', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerPreguntasPorExamen:', e);
    return [];
  }
}

/**
 * Obtiene la ventana de apertura/cierre del examen vinculado a una
 * carrera (a través de la tabla puente examen_carrera).
 */
export async function obtenerVentanaExamenPorCarrera(
  carreraId: number
): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from('examen_carrera')
      .select('examenes(fecha_apertura, fecha_cierre)')
      .eq('carrera_id', carreraId)
      .order('examen_id', { ascending: false })
      .limit(1);
    if (error) throw error;

    if (!data || data.length === 0) return null;
    const examen = data[0].examenes;
    return examen && typeof examen === 'object' ? (examen as Record<string, any>) : null;
  } catch (e) {
    console.warn('Error en obtenerVentanaExamenPorCarrera:', e);
    return null;
  }
}
