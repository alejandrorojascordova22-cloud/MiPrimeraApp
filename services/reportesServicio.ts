import {
  generarReporteAspirantesPeriodo,
  purgarAspirantesPeriodo,
} from "./resultadosAdminServicio";

/**
 * "Ciclo de Vida de Datos" — generar reporte de un periodo de admisión y
 * purgar (borrar definitivamente) los aspirantes de un periodo caducado.
 */
export { generarReporteAspirantesPeriodo, purgarAspirantesPeriodo };

/**
 * Convierte el reporte a texto CSV (respaldo simple del periodo antes de
 * purgar). En el Flutter original se generaba un .xlsx con formato — aquí
 * se simplificó a CSV para no depender de una librería de Excel dentro de
 * React Native (ver nota de instalación al final de la respuesta).
 */
export function reporteACsv(
  reporte: Record<string, any>[],
  ano: number,
): string {
  const encabezados = [
    "#",
    "NOMBRE",
    "FOLIO",
    "CARRERA",
    "CORREO",
    "ASISTENCIA",
    "CALIFICACION",
    "ESTADO",
  ];
  const escapar = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const filas = reporte.map((item, i) => {
    const carreraNombre = item.carreras?.nombre ?? item.carrera_nombre ?? "—";
    return [
      i + 1,
      item.nombre ?? "—",
      item.folio ?? "—",
      carreraNombre,
      item.correo ?? "—",
      item.asistencia ? "Presente" : "Ausente",
      item.resultado == null ? "—" : `${item.resultado}%`,
      item.estado ?? "pendiente",
    ]
      .map(escapar)
      .join(",");
  });

  return [
    `"Reporte del periodo de admision ${ano}"`,
    `"Total de aspirantes: ${reporte.length}"`,
    encabezados.join(","),
    ...filas,
  ].join("\n");
}
