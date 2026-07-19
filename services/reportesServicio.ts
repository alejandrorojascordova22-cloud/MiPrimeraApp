import { supabase } from './supabaseClient';

/**
 * "Ciclo de Vida de Datos" — generar reporte de un periodo de admisión y
 * purgar (borrar definitivamente) los aspirantes de un periodo caducado.
 * Migrado de las funciones sueltas de lib/datos/supabase_service.dart
 * (generarReporteAspirantesPeriodo / purgarAspirantesPeriodo). No existían
 * en ningún archivo .ts todavía.
 */

/** Trae todos los aspirantes cuyo folio contiene "UTO-{ano}-" con su carrera. */
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
 * Purga (borra) todos los aspirantes de un periodo y sus respuestas.
 * Borra primero `respuestas` y después `aspirantes` para respetar la FK,
 * igual que en el Flutter original.
 */
export async function purgarAspirantesPeriodo(ano: number): Promise<boolean> {
  try {
    const { data: aspirantesParaPurgar, error: errBusqueda } = await supabase
      .from('aspirantes')
      .select('id')
      .like('folio', `%UTO-${ano}-%`);
    if (errBusqueda) throw errBusqueda;

    if (!aspirantesParaPurgar || aspirantesParaPurgar.length === 0) {
      // Nada que purgar, no es un error.
      return true;
    }

    const ids = aspirantesParaPurgar.map((a) => a.id);

    const { error: errRespuestas } = await supabase
      .from('respuestas')
      .delete()
      .in('aspirante_id', ids);
    if (errRespuestas) throw errRespuestas;

    // Se pide `select('id')` para verificar cuántas filas se eliminaron
    // realmente: si RLS bloquea el delete, Supabase no manda error, pero
    // tampoco devuelve filas eliminadas.
    const { data: aspirantesEliminados, error: errAspirantes } = await supabase
      .from('aspirantes')
      .delete()
      .in('id', ids)
      .select('id');
    if (errAspirantes) throw errAspirantes;

    if (!aspirantesEliminados || aspirantesEliminados.length === 0) {
      console.warn(
        'purgarAspirantesPeriodo: 0 aspirantes eliminados (posible bloqueo de RLS).',
      );
      return false;
    }

    if (aspirantesEliminados.length < ids.length) {
      console.warn(
        `purgarAspirantesPeriodo: solo se eliminaron ${aspirantesEliminados.length} de ${ids.length} aspirantes (posible RLS parcial).`,
      );
    }

    return true;
  } catch (e) {
    console.warn('Error en purgarAspirantesPeriodo:', e);
    return false;
  }
}

/**
 * Convierte el reporte a texto CSV (respaldo simple del periodo antes de
 * purgar). En el Flutter original se generaba un .xlsx con formato — aquí
 * se simplificó a CSV para no depender de una librería de Excel dentro de
 * React Native (ver nota de instalación al final de la respuesta).
 */
export function reporteACsv(reporte: Record<string, any>[], ano: number): string {
  const encabezados = [
    '#',
    'NOMBRE',
    'FOLIO',
    'CARRERA',
    'CORREO',
    'ASISTENCIA',
    'CALIFICACION',
    'ESTADO',
  ];
  const escapar = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const filas = reporte.map((item, i) => {
    const carreraNombre =
      item.carreras?.nombre ?? item.carrera_nombre ?? '—';
    return [
      i + 1,
      item.nombre ?? '—',
      item.folio ?? '—',
      carreraNombre,
      item.correo ?? '—',
      item.asistencia ? 'Presente' : 'Ausente',
      item.resultado == null ? '—' : `${item.resultado}%`,
      item.estado ?? 'pendiente',
    ]
      .map(escapar)
      .join(',');
  });

  return [
    `"Reporte del periodo de admision ${ano}"`,
    `"Total de aspirantes: ${reporte.length}"`,
    encabezados.join(','),
    ...filas,
  ].join('\n');
}