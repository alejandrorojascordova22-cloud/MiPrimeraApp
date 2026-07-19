import { supabase } from './supabaseClient';

/**
 * Servicio para el panel de administración del envío automático de correos,
 * dashboard y su historial.
 * Migrado de lib/datos/correos_config_servicio.dart
 *
 * No envía correos (eso ya lo hace la Edge Function `enviar-correo-aspirante`).
 * Este servicio solo lee/edita la configuración y consulta el historial.
 */

/**
 * Trae la fila única de configuración (id = 1).
 * Antes de leer, llama al RPC que reinicia el contador si cambió el día,
 * así el dashboard siempre muestra el conteo correcto de "hoy".
 */
export async function obtenerConfiguracion(): Promise<Record<string, any> | null> {
  try {
    // Si tu función RPC no existe con este nombre, esta llamada
    // simplemente se ignora (catch) y se sigue leyendo la config.
    try {
      await supabase.rpc('reiniciar_contador_si_es_nuevo_dia');
    } catch (e) {
      console.warn('Aviso: no se pudo llamar reiniciar_contador_si_es_nuevo_dia:', e);
    }

    const { data, error } = await supabase
      .from('configuracion_correos')
      .select()
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn('Error en obtenerConfiguracion:', e);
    return null;
  }
}

async function actualizar(cambios: Record<string, any>): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('configuracion_correos')
      .update(cambios)
      .eq('id', 1)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    // Si RLS bloquea el update, Supabase no manda error, pero tampoco
    // devuelve la fila afectada. Sin este chequeo, la función devolvía
    // `true` (éxito) aunque en realidad no se guardó nada.
    if (!data) {
      console.warn(
        'actualizar(configuracion_correos): 0 filas afectadas (posible bloqueo de RLS).',
      );
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error al actualizar configuracion_correos:', e);
    return false;
  }
}

/** Activa o desactiva el envío automático. */
export async function actualizarModoAutomatico(activo: boolean): Promise<boolean> {
  return actualizar({
    modo_automatico: activo,
    ultima_actualizacion: new Date().toISOString(),
  });
}

/**
 * Activa o desactiva SOLO los correos de registro (tipo 'confirmacion'),
 * sin afectar los correos de resultado. Requiere la columna
 * `registro_automatico_activo` en `configuracion_correos`.
 */
export async function actualizarRegistroAutomatico(activo: boolean): Promise<boolean> {
  return actualizar({
    registro_automatico_activo: activo,
    ultima_actualizacion: new Date().toISOString(),
  });
}

/** Actualiza el límite diario y el umbral de alerta (%). */
export async function actualizarLimites({
  limiteDiario,
  umbralAlerta,
}: {
  limiteDiario: number;
  umbralAlerta: number;
}): Promise<boolean> {
  return actualizar({
    limite_diario: limiteDiario,
    umbral_alerta: umbralAlerta,
    ultima_actualizacion: new Date().toISOString(),
  });
}

/** Reinicia manualmente el contador de correos enviados hoy a 0. */
export async function reiniciarContadorManual(): Promise<boolean> {
  return actualizar({
    correos_enviados_hoy: 0,
    ultima_actualizacion: new Date().toISOString(),
  });
}

/**
 * Historial de correos, más reciente primero.
 * tipo: 'confirmacion' | 'resultado' | undefined (todos)
 * estado: 'enviado' | 'error' | 'omitido' | undefined (todos)
 */
export async function obtenerHistorial({
  tipo,
  estado,
  limite = 50,
}: {
  tipo?: string;
  estado?: string;
  limite?: number;
} = {}): Promise<Record<string, any>[]> {
  try {
    let query = supabase.from('historial_correos').select();

    if (tipo) query = query.eq('tipo', tipo);
    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query.order('fecha', { ascending: false }).limit(limite);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerHistorial:', e);
    return [];
  }
}

/**
 * Cuenta cuántos correos se enviaron exitosamente hoy directamente
 * del historial (útil como verificación cruzada del contador).
 */
export async function contarEnviadosHoy(): Promise<number> {
  try {
    const ahora = new Date();
    const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));

    const { data, error } = await supabase
      .from('historial_correos')
      .select('id')
      .eq('estado', 'enviado')
      .gte('fecha', desde.toISOString());

    if (error) throw error;
    return (data ?? []).length;
  } catch (e) {
    console.warn('Error en contarEnviadosHoy:', e);
    return 0;
  }
}