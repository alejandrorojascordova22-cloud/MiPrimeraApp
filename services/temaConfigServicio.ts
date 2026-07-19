import { supabase } from './supabaseClient';
import {
  TemaConfig,
  temaConfigPorDefecto,
  temaConfigFromMap,
  temaConfigToMap,
} from './temaConfig';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function obtenerTema(): Promise<TemaConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracion_tema')
      .select()
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return temaConfigPorDefecto();
    return temaConfigFromMap(data);
  } catch {
    return temaConfigPorDefecto();
  }
}

export async function guardarTema(tema: TemaConfig): Promise<boolean> {
  try {
    const { error } = await supabase.from('configuracion_tema').upsert({
      id: 1,
      ...temaConfigToMap(tema),
      actualizado_en: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export function escucharTema(
  onCambio: (tema: TemaConfig) => void
): RealtimeChannel {
  return supabase
    .channel('configuracion_tema_cambios')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'configuracion_tema' },
      (payload: { new: Record<string, any> }) => {
        const nuevo = payload.new;
        if (nuevo && Object.keys(nuevo).length > 0) {
          onCambio(temaConfigFromMap(nuevo));
        }
      }
    )
    .subscribe();
}
