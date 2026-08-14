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
    if (!error) {
      return res ?? null;
    }

    console.warn('agregarCarrera: INSERT directo falló, reintentando RPC admin', error);

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'crear_carrera_admin',
      { p_nombre: nombre, p_tipo: tipo }
    );

    if (rpcError) throw rpcError;
    return Array.isArray(rpcData) ? rpcData[0] ?? null : rpcData ?? null;
  } catch (e) {
    console.warn('Error en agregarCarrera:', e);
    return null;
  }
}

/** Actualiza el nombre o tipo de una carrera existente.
 *
 * Primero intenta el UPDATE directo; si la tabla tiene RLS o restricciones de
 * seguridad por políticas, reintenta con un RPC de administración, que evita
 * el bloqueo del navegador/celular y funciona mejor en Supabase.
 */
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

    if (!error) {
      return res != null;
    }

    console.warn('actualizarCarrera: UPDATE directo falló, reintentando RPC admin', error);

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'actualizar_carrera_admin',
      { p_carrera_id: id, p_nombre: nombre, p_tipo: tipo }
    );

    if (rpcError) throw rpcError;
    return !!rpcData;
  } catch (e) {
    console.warn('Error en actualizarCarrera:', e);
    return false;
  }
}

/** Elimina una carrera de la base de datos.
 *
 * Si la fila está referenciada por aspirantes, materiales o exámenes, la base
 * de datos suele rechazar el borrado con un error de clave foránea. En ese
 * caso, el usuario debe reasignar o limpiar esos registros antes de borrar.
 */
export async function eliminarCarrera(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from('carreras').delete().eq('id', id);
    if (!error) {
      return true;
    }

    console.warn('eliminarCarrera: DELETE directo falló, reintentando RPC admin', error);

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'eliminar_carrera_admin',
      { p_carrera_id: id }
    );

    if (rpcError) throw rpcError;
    return !!rpcData;
  } catch (e) {
    console.warn('Error en eliminarCarrera:', e);
    return false;
  }
}
