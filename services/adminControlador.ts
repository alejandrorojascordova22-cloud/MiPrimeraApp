import { aspiranteFromMap } from "../types/aspirante";
import type {
  EstadisticasExamen,
  ResultadoAspirante,
} from "../types/resultadoAspirante";
import { obtenerResultadosAdmin } from "./resultadosAdminServicio";

/**
 * Casos de uso del panel administrativo: obtener resultados ya armados,
 * filtrar por carrera y calcular las estadísticas de las tarjetas del resumen.
 * Migrado de lib/dominio/admin_controlador.dart
 *
 * Nota: en Flutter esta lógica estaba repartida en 3 archivos (admin_controlador.dart
 * + dominio/admin_repository.dart + datos/admin_repository.dart, que era la
 * interfaz + su implementación del patrón Repository). En React Native no hace
 * falta esa capa extra de abstracción para un proyecto de este tamaño, así que
 * aquí queda todo junto en un solo archivo con el mismo resultado funcional.
 */

/** Obtiene todos los resultados desde la capa de datos, ya listos para el panel. */
export async function obtenerResultados(): Promise<ResultadoAspirante[]> {
  const listaDeMapas = await obtenerResultadosAdmin();

  return listaDeMapas.map((m) => {
    // Usamos el helper de Aspirante que ya maneja la extracción de la carrera.
    const aspirante = aspiranteFromMap(m);

    // Aseguramos que los valores numéricos sean del tipo correcto
    const calificacion = Number(m.resultado ?? 0);
    const aciertos = Number(m.aciertos ?? 0);

    return {
      aspirante,
      calificacion,
      aciertos,
      aprobado: calificacion >= 70,
      correoEnviado: m.correo_enviado === true,
    };
  });
}

/** Filtra la lista según la carrera seleccionada. */
export function filtrarPorCarrera(
  lista: ResultadoAspirante[],
  carrera: string,
): ResultadoAspirante[] {
  if (carrera === "Todas") return lista;
  return lista.filter((r) => r.aspirante.carreraNombre.includes(carrera));
}

/** Calcula las estadísticas para las tarjetas del resumen. */
export function calcularEstadisticas(
  lista: ResultadoAspirante[],
): EstadisticasExamen {
  const terminados = lista.filter(
    (r) => r.aspirante.estado === "terminado" && r.calificacion != null,
  );
  const aprobados = terminados.filter((r) => r.aprobado).length;
  const enProgreso = lista.filter(
    (r) => r.aspirante.estado === "en_progreso",
  ).length;

  const distribucion = [0, 0, 0, 0, 0]; // 0-19, 20-39, 40-59, 60-79, 80-100
  for (const r of terminados) {
    if (r.calificacion < 20) distribucion[0]++;
    else if (r.calificacion < 40) distribucion[1]++;
    else if (r.calificacion < 60) distribucion[2]++;
    else if (r.calificacion < 80) distribucion[3]++;
    else distribucion[4]++;
  }

  let promedio = 0;
  if (terminados.length > 0) {
    promedio =
      terminados.reduce((suma, r) => suma + r.calificacion, 0) /
      terminados.length;
  }

  return {
    total: lista.length,
    terminados: terminados.length,
    aprobados,
    enProgreso,
    promedioGeneral: promedio,
    reprobados: terminados.length - aprobados,
    distribucion,
  };
}
