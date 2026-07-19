import type { Aspirante } from "./aspirante";

/**
 * Resultado de examen ya "armado" para el panel de administración:
 * combina los datos del aspirante con su calificación.
 * Migrado de lib/dominio/resultado_aspirante.dart
 */
export interface ResultadoAspirante {
  aspirante: Aspirante;
  calificacion: number;
  aciertos: number;
  aprobado: boolean;
  correoEnviado: boolean;
}

/** Estadísticas resumidas que se muestran en las tarjetas del dashboard. */
export interface EstadisticasExamen {
  total: number;
  terminados: number;
  aprobados: number;
  reprobados: number;
  enProgreso: number;
  promedioGeneral: number;
  distribucion: number[];
}
