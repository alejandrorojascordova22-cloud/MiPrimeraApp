import { supabase } from './supabaseClient';

/**
 * Consultas de resultados para el panel de administración y reportes
 * por periodo/ciclo escolar.
 * Migrado de la parte "resultados admin" de lib/datos/supabase_service.dart
 */

/** Obtiene todos los aspirantes (con su carrera) para el panel de administración. */
export async function obtenerResultadosAdmin(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('aspirantes')
      .select('*, carreras(nombre)')
      .order('id', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerResultadosAdmin:', e);
    return [];
  }
}

/**
 * Obtiene los resultados (calificación, aciertos, estado) de los aspirantes
 * de una carrera, ordenados de mayor a menor calificación.
 */
export async function obtenerResultadosPorCarrera(
  carreraId: number
): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('aspirantes')
      .select(
        'id, folio, nombre, correo, estado, resultado, aciertos, ' +
          'examen_finalizado, asistencia, hora_inicio, hora_fin, fecha_calificacion'
      )
      .eq('carrera_id', carreraId)
      .order('resultado', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerResultadosPorCarrera:', e);
    return [];
  }
}

/** Genera un reporte de todos los aspirantes de un ciclo/periodo (por año, según su folio). */
export async function generarReporteAspirantesPeriodo(
  ano: number
): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('aspirantes')
      .select('*, carreras(nombre)')
      .like('folio', `%UTO-${ano}-%`)
      .order('id', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en generarReporteAspirantesPeriodo:', e);
    return [];
  }
}

/**
 * Purga todos los registros históricos de un ciclo escolar por lote.
 * Elimina primero las respuestas y luego los aspirantes para respetar las
 * llaves foráneas (foreign keys).
 *
 * ⚠️ Esto es IRREVERSIBLE.
 */
export async function purgarAspirantesPeriodo(ano: number): Promise<boolean> {
  try {
    const { data: aspirantesParaPurgar, error: errorSelect } = await supabase
      .from('aspirantes')
      .select('id')
      .like('folio', `%UTO-${ano}-%`);
    if (errorSelect) throw errorSelect;

    if (!aspirantesParaPurgar || aspirantesParaPurgar.length === 0) {
      console.log(`purgarAspirantesPeriodo: No hay aspirantes del año ${ano}, nada que purgar.`);
      return true;
    }

    const aspiranteIds = aspirantesParaPurgar.map((a) => a.id as number);

    console.log(
      `purgarAspirantesPeriodo: Purgando ${aspiranteIds.length} aspirantes del año ${ano}...`
    );

    // 1. Borrar respuestas relacionadas primero (respetar FK)
    const { error: errorRespuestas } = await supabase
      .from('respuestas')
      .delete()
      .in('aspirante_id', aspiranteIds);
    if (errorRespuestas) throw errorRespuestas;

    // 2. Borrar los aspirantes. Se pide `select('id')` para poder verificar
    // cuántas filas se eliminaron realmente: si RLS bloquea el delete,
    // Supabase no manda error, pero tampoco devuelve filas eliminadas.
    const { data: aspirantesEliminados, error: errorAspirantes } = await supabase
      .from('aspirantes')
      .delete()
      .in('id', aspiranteIds)
      .select('id');
    if (errorAspirantes) throw errorAspirantes;

    if (!aspirantesEliminados || aspirantesEliminados.length === 0) {
      console.warn(
        'purgarAspirantesPeriodo: 0 aspirantes eliminados (posible bloqueo de RLS).',
      );
      return false;
    }

    if (aspirantesEliminados.length < aspiranteIds.length) {
      console.warn(
        `purgarAspirantesPeriodo: solo se eliminaron ${aspirantesEliminados.length} de ${aspiranteIds.length} aspirantes (posible RLS parcial).`,
      );
    }

    console.log('purgarAspirantesPeriodo: Purga completada correctamente.');
    return true;
  } catch (e) {
    console.warn('Error en purgarAspirantesPeriodo:', e);
    return false;
  }
}