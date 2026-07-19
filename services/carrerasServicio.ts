import { supabase } from './supabaseClient';

/**
 * Todo lo relacionado con las carreras (programas de estudio).
 * Migrado de la parte "carreras" de lib/datos/supabase_service.dart
 */

/** Obtiene todas las carreras, ordenadas alfabéticamente. */
export async function obtenerCarreras(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase.from('carreras').select().order('nombre');
    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn('⚠️ Aviso: No se encontraron carreras en la tabla "carreras".');
    }
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerCarreras:', e);
    return [];
  }
}

/** Agrega una nueva carrera a la base de datos. */
export async function agregarCarrera(
  nombre: string,
  tipo: string
): Promise<Record<string, any> | null> {
  try {
    const { data: res, error } = await supabase
      .from('carreras')
      .insert({ nombre, tipo })
      .select()
      .maybeSingle();
    if (error) throw error;
    return res ?? null;
  } catch (e) {
    console.warn('Error en agregarCarrera:', e);
    return null;
  }
}

/** Actualiza el nombre o tipo de una carrera existente. */
export async function actualizarCarrera(
  id: number,
  nombre: string,
  tipo: string
): Promise<boolean> {
  try {
    const { data: res, error } = await supabase
      .from('carreras')
      .update({ nombre, tipo })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return res != null;
  } catch (e) {
    console.warn('Error en actualizarCarrera:', e);
    return false;
  }
}

/** Elimina una carrera de la base de datos. */
export async function eliminarCarrera(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from('carreras').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en eliminarCarrera:', e);
    return false;
  }
}
