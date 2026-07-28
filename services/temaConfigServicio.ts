import { supabase } from './supabaseClient';
import {
  TemaConfig,
  RolTema,
  temaConfigPorDefecto,
  temaConfigFromMap,
  temaConfigToMap,
} from './temaConfig';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function obtenerTema(rol: RolTema): Promise<TemaConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracion_tema')
      .select()
      .eq('rol', rol)
      .maybeSingle();

    if (error || !data) return temaConfigPorDefecto(rol);
    return temaConfigFromMap(data);
  } catch {
    return temaConfigPorDefecto(rol);
  }
}

export async function guardarTema(tema: TemaConfig): Promise<boolean> {
  try {
    const { error } = await supabase.from('configuracion_tema').upsert(
      {
        ...temaConfigToMap(tema),
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: 'rol' }
    );
    return !error;
  } catch {
    return false;
  }
}

export function escucharTema(
  rol: RolTema,
  onCambio: (tema: TemaConfig) => void
): RealtimeChannel {
  return supabase
    .channel(`configuracion_tema_cambios_${rol}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'configuracion_tema', filter: `rol=eq.${rol}` },
      (payload: { new: Record<string, any> }) => {
        const nuevo = payload.new;
        if (nuevo && Object.keys(nuevo).length > 0) {
          onCambio(temaConfigFromMap(nuevo));
        }
      }
    )
    .subscribe();
}