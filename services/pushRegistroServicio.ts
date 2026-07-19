import { supabase } from './supabaseClient';

/**
 * Registro de tokens de push (Expo) por aspirante.
 * Tabla: push_tokens (aspirante_id, token, plataforma, actualizado_en)
 * Un mismo aspirante puede tener varios tokens (varios dispositivos).
 */

export async function guardarTokenPush({
  aspiranteId,
  token,
  plataforma,
}: {
  aspiranteId: number;
  token: string;
  plataforma?: string;
}): Promise<boolean> {
  try {
    if (!aspiranteId || !token) return false;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        aspirante_id: aspiranteId,
        token,
        plataforma: plataforma ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en guardarTokenPush:', e);
    return false;
  }
}

export async function eliminarTokenPush(token: string): Promise<boolean> {
  try {
    if (!token) return false;
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en eliminarTokenPush:', e);
    return false;
  }
}

export async function obtenerTokensPorAspirante(aspiranteId: number): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('aspirante_id', aspiranteId);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.token).filter(Boolean);
  } catch (e) {
    console.warn('Error en obtenerTokensPorAspirante:', e);
    return [];
  }
}

export async function obtenerTokensPorAspirantes(aspiranteIds: number[]): Promise<string[]> {
  try {
    if (!aspiranteIds?.length) return [];
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('aspirante_id', aspiranteIds);
    if (error) throw error;
    return (data ?? []).map((r: any) => r.token).filter(Boolean);
  } catch (e) {
    console.warn('Error en obtenerTokensPorAspirantes:', e);
    return [];
  }
}
