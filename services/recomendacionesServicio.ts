import { supabase } from './supabaseClient';
import { obtenerMaterialesParaCarrera } from './materialesEstudioServicio';

/**
 * Recomendación de materiales de estudio según el desempeño real del
 * aspirante: cruza sus respuestas (tabla `respuestas`) con la materia de
 * cada pregunta (preguntas -> examenes.materia) para encontrar sus temas
 * más débiles, y sugiere primero los materiales etiquetados con esa
 * misma materia.
 *
 * Requiere que `materiales_estudio.materia` use los mismos valores que
 * `examenes.materia` (ver sql/002_materiales_avisos.sql).
 */

export interface DesempenoPorMateria {
  materia: string;
  correctas: number;
  total: number;
  porcentaje: number; // 0-100
}

/** Desglosa el desempeño del aspirante por materia, de peor a mejor. */
export async function obtenerDesempenoPorMateria(
  aspiranteId: number
): Promise<DesempenoPorMateria[]> {
  try {
    const { data, error } = await supabase
      .from('respuestas')
      .select('respuesta, preguntas(respuesta_correcta, examenes(materia))')
      .eq('aspirante_id', aspiranteId);
    if (error) throw error;

    const acumulado = new Map<string, { correctas: number; total: number }>();

    for (const fila of data ?? []) {
      const pregunta = (fila as any).preguntas;
      const materia: string | undefined = pregunta?.examenes?.materia;
      if (!materia) continue;

      const actual = acumulado.get(materia) ?? { correctas: 0, total: 0 };
      actual.total += 1;
      if (fila.respuesta === pregunta.respuesta_correcta) {
        actual.correctas += 1;
      }
      acumulado.set(materia, actual);
    }

    return Array.from(acumulado.entries())
      .map(([materia, { correctas, total }]) => ({
        materia,
        correctas,
        total,
        porcentaje: total === 0 ? 0 : Math.round((correctas / total) * 100),
      }))
      .sort((a, b) => a.porcentaje - b.porcentaje); // peor primero
  } catch (e) {
    console.warn('Error en obtenerDesempenoPorMateria:', e);
    return [];
  }
}

/**
 * Materiales recomendados para un aspirante: primero los de sus materias
 * más débiles (según `obtenerDesempenoPorMateria`), después el resto de
 * materiales visibles para su carrera. `umbralDebil` (0-100) define qué
 * tan bajo debe ser el % de aciertos para considerar la materia débil.
 */
export async function obtenerMaterialesRecomendados(
  aspiranteId: number,
  carreraId: number,
  umbralDebil = 70
): Promise<Record<string, any>[]> {
  try {
    const [desempeno, materiales] = await Promise.all([
      obtenerDesempenoPorMateria(aspiranteId),
      obtenerMaterialesParaCarrera(carreraId),
    ]);

    const materiasDebiles = new Set(
      desempeno.filter((d) => d.porcentaje < umbralDebil).map((d) => d.materia)
    );

    if (materiasDebiles.size === 0) {
      // Sin datos de examen todavía (o buen desempeño general): se
      // regresa la lista normal, sin reordenar.
      return materiales;
    }

    const recomendados = materiales.filter((m) => materiasDebiles.has(m.materia));
    const resto = materiales.filter((m) => !materiasDebiles.has(m.materia));
    return [...recomendados, ...resto];
  } catch (e) {
    console.warn('Error en obtenerMaterialesRecomendados:', e);
    return [];
  }
}
