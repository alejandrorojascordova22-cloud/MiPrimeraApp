import { supabase } from './supabaseClient';

/**
 * Tablón de avisos: el admin publica anuncios (material nuevo, cambio de
 * fecha, recordatorios) y los aspirantes los ven dentro del app, con
 * marca de leído/no leído. Complementa (no reemplaza) el correo: sirve
 * como respaldo confiable dentro de la app, con o sin push.
 */

export interface Aviso {
  id: number;
  titulo: string;
  contenido: string;
  carrera_id: number | null; // null = para todas las carreras
  creado_en: string;
  activo: boolean;
  leido?: boolean; // se agrega al consultar para un aspirante específico
}

/**
 * Publica un nuevo aviso. `carreraId` en null significa "para todas".
 * Devuelve `ok: true` si el insert no tiró error, aunque `aviso` venga
 * null (puede pasar si RLS no deja hacer SELECT de la fila recién
 * insertada). Antes esto se confundía con un fallo y la pantalla se
 * quedaba sin refrescar; ahora `ok` es la única señal de éxito/error real.
 */
export async function publicarAviso({
  titulo,
  contenido,
  carreraId = null,
  creadoPor,
}: {
  titulo: string;
  contenido: string;
  carreraId?: number | null;
  creadoPor?: number;
}): Promise<{ ok: boolean; aviso: Aviso | null }> {
  try {
    const { data, error } = await supabase
      .from('avisos')
      .insert({
        titulo,
        contenido,
        carrera_id: carreraId,
        creado_por: creadoPor,
      })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { ok: true, aviso: data ?? null };
  } catch (e) {
    console.warn('Error en publicarAviso:', e);
    return { ok: false, aviso: null };
  }
}

/**
 * Desactiva un aviso desde la sesión del ADMIN. Usa un RPC con
 * `SECURITY DEFINER` para saltar el RLS que solo deja modificar al
 * `creado_por`. Esto permite a cualquier admin desactivar cualquier aviso.
 */
export async function desactivarAvisoComoAdmin(avisoId: number): Promise<boolean> {
  try {
    // Asumimos que existe un RPC `desactivar_aviso_admin` similar al de aspirante.
    // Si no, se puede crear o adaptar el existente.
    const { error } = await supabase.rpc('desactivar_aviso_admin', {
      p_aviso_id: avisoId,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en desactivarAvisoComoAdmin:', e);
    return false;
  }
}

/** Da de baja (soft delete) un aviso sin borrar su historial de lectura. */
export async function desactivarAviso(avisoId: number): Promise<boolean> {
  try {
    const okRpc = await desactivarAvisoComoAdmin(avisoId);
    if (okRpc) return true;

    const { error } = await supabase
      .from('avisos')
      .update({ activo: false })
      .eq('id', avisoId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en desactivarAviso:', e);
    return false;
  }
}

/** Todos los avisos (para el panel de admin), incluyendo inactivos. */
export async function obtenerTodosLosAvisos(): Promise<Aviso[]> {
  try {
    const { data, error } = await supabase
      .from('avisos')
      .select('*, carreras(nombre)')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerTodosLosAvisos:', e);
    return [];
  }
}

/**
 * Avisos visibles para un aspirante: los generales (carrera_id null) más
 * los de su carrera, marcados con `leido` según `avisos_lectura`.
 */
export async function obtenerAvisosParaAspirante(
  aspiranteId: number,
  carreraId: number
): Promise<Aviso[]> {
  try {
    const { data: avisos, error } = await supabase
      .from('avisos')
      .select('*')
      .eq('activo', true)
      .or(`carrera_id.is.null,carrera_id.eq.${carreraId}`)
      .order('creado_en', { ascending: false });
    if (error) throw error;

    const { data: leidos, error: e2 } = await supabase
      .from('avisos_lectura')
      .select('aviso_id')
      .eq('aspirante_id', aspiranteId);
    if (e2) throw e2;

    const idsLeidos = new Set((leidos ?? []).map((f) => f.aviso_id));
    return (avisos ?? []).map((a) => ({ ...a, leido: idsLeidos.has(a.id) }));
  } catch (e) {
    console.warn('Error en obtenerAvisosParaAspirante:', e);
    return [];
  }
}

/** Marca un aviso como leído por un aspirante (idempotente). */
export async function marcarAvisoLeido(avisoId: number, aspiranteId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('avisos_lectura')
      .upsert([{ aviso_id: avisoId, aspirante_id: aspiranteId }], {
        onConflict: 'aviso_id,aspirante_id',
      });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en marcarAvisoLeido:', e);
    return false;
  }
}

/** Cuenta de avisos no leídos, útil para un badge en la navegación. */
export async function contarAvisosNoLeidos(
  aspiranteId: number,
  carreraId: number
): Promise<number> {
  const avisos = await obtenerAvisosParaAspirante(aspiranteId, carreraId);
  return avisos.filter((a) => !a.leido).length;
}