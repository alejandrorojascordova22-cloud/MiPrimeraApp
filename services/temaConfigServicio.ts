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

// Reutiliza el mismo bucket que "materiales de estudio" (ya existe y
// funciona en el proyecto) para no depender de crear uno nuevo en Supabase.
// Las imágenes de fondo se guardan bajo el prefijo "fondos_tema/".
const BUCKET_FONDOS = 'materiales_estudio';

/**
 * Sube una imagen de fondo (elegida por el admin desde su celular o
 * computadora) a Supabase Storage y devuelve su URL pública, lista para
 * guardarse en fondoImagenUrl.
 */
export async function subirImagenFondoTema(
  rol: RolTema,
  bytes: Blob | ArrayBuffer,
  nombreOriginal: string,
  mimeType?: string
): Promise<string | null> {
  try {
    const limpio = nombreOriginal.replace(/[^\w.\-]/g, '_');
    const ruta = `fondos_tema/${rol}_${Date.now()}_${limpio}`;
    const { error: errorUpload } = await supabase.storage
      .from(BUCKET_FONDOS)
      .upload(ruta, bytes, { contentType: mimeType, upsert: true });
    if (errorUpload) throw errorUpload;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_FONDOS).getPublicUrl(ruta);
    return publicUrl;
  } catch (e) {
    console.warn('Error en subirImagenFondoTema:', e);
    return null;
  }
}

/**
 * Lista las imágenes de fondo ya subidas para un rol (más recientes
 * primero), leyendo directo el bucket de Storage. Sirve para mostrar un
 * carrete de "recientes" en Ajustes del Sistema y así no tener que volver
 * a elegir/subir el mismo archivo cada vez.
 */
export async function listarImagenesFondoRecientes(
  rol: RolTema,
  limite = 12
): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_FONDOS)
      .list('fondos_tema', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    if (error || !data) return [];

    return data
      .filter((archivo) => archivo.name.startsWith(`${rol}_`))
      .slice(0, limite)
      .map(
        (archivo) =>
          supabase.storage
            .from(BUCKET_FONDOS)
            .getPublicUrl(`fondos_tema/${archivo.name}`).data.publicUrl
      );
  } catch (e) {
    console.warn('Error en listarImagenesFondoRecientes:', e);
    return [];
  }
}

export async function guardarTema(
  tema: TemaConfig
): Promise<{ exito: boolean; error?: string }> {
  try {
    const { error, status, statusText } = await supabase
      .from('configuracion_tema')
      .upsert(
        {
          ...temaConfigToMap(tema),
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'rol' }
      );
    if (error) {
      console.warn('Error en guardarTema:', status, statusText, error);
      return {
        exito: false,
        error: `${error.message ?? 'Error desconocido'}${error.code ? ` (código ${error.code})` : ''}`,
      };
    }
    return { exito: true };
  } catch (e: any) {
    console.warn('Excepción en guardarTema:', e);
    return { exito: false, error: e?.message ?? String(e) };
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