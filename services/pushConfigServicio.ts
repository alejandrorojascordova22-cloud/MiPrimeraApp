import { supabase } from './supabaseClient';

/**
 * Configuración y control de límites de las notificaciones push (Expo).
 * Mismo patrón que correosConfigServicio.ts: fila única de config (id=1),
 * contador diario que se reinicia solo, umbral de alerta (%) e historial.
 *
 * Por qué existe esto: el envío en sí usa el servicio gratuito de Expo
 * Push (https://exp.host/--/api/v2/push/send), que no cobra por envío,
 * pero nosotros nos ponemos nuestro propio tope diario para no abusar
 * del servicio ni mandar de más — igual que con los correos.
 */

export async function obtenerConfiguracionPush(): Promise<Record<string, any> | null> {
  try {
    try {
      await supabase.rpc('reiniciar_contador_push_si_es_nuevo_dia');
    } catch (e) {
      console.warn('Aviso: no se pudo llamar reiniciar_contador_push_si_es_nuevo_dia:', e);
    }

    const { data, error } = await supabase
      .from('configuracion_push')
      .select()
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn('Error en obtenerConfiguracionPush:', e);
    return null;
  }
}

async function actualizar(cambios: Record<string, any>): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('configuracion_push')
      .update(cambios)
      .eq('id', 1)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      console.warn('actualizar(configuracion_push): 0 filas afectadas (posible bloqueo de RLS).');
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error al actualizar configuracion_push:', e);
    return false;
  }
}

/** Activa o desactiva el envío automático de push. */
export async function actualizarModoAutomaticoPush(activo: boolean): Promise<boolean> {
  return actualizar({ modo_automatico: activo, ultima_actualizacion: new Date().toISOString() });
}

/** Actualiza el límite diario y el umbral de alerta (%) de push. */
export async function actualizarLimitesPush({
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

/** Reinicia manualmente el contador de push enviados hoy a 0. */
export async function reiniciarContadorPushManual(): Promise<boolean> {
  return actualizar({
    notificaciones_enviadas_hoy: 0,
    limite_excedido: false,
    ultima_actualizacion: new Date().toISOString(),
  });
}

/**
 * Historial de push, más reciente primero.
 * estado: 'enviado' | 'error' | 'omitido_por_limite' | undefined (todos)
 */
export async function obtenerHistorialPush({
  estado,
  limite = 50,
}: {
  estado?: string;
  limite?: number;
} = {}): Promise<Record<string, any>[]> {
  try {
    let query = supabase.from('historial_push').select();
    if (estado) query = query.eq('estado', estado);

    const { data, error } = await query.order('fecha', { ascending: false }).limit(limite);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerHistorialPush:', e);
    return [];
  }
}

/**
 * Calcula el estado del límite para mostrar en el panel: cuántas van,
 * el % contra el límite diario, si ya llegamos al umbral de alerta y si
 * ya se excedió (para "saber si se excedió el límite").
 */
export function calcularEstadoLimitePush(config: Record<string, any> | null) {
  const enviadasHoy = Number(config?.notificaciones_enviadas_hoy ?? 0);
  const limiteDiario = Number(config?.limite_diario ?? 0);
  const umbralAlerta = Number(config?.umbral_alerta ?? 70);
  const porcentaje = limiteDiario > 0 ? (enviadasHoy / limiteDiario) * 100 : 0;

  return {
    enviadasHoy,
    limiteDiario,
    umbralAlerta,
    porcentaje,
    enAlerta: limiteDiario > 0 && porcentaje >= umbralAlerta,
    excedido: Boolean(config?.limite_excedido) || (limiteDiario > 0 && enviadasHoy >= limiteDiario),
  };
}