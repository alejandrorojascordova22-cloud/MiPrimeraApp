import { supabase } from './supabaseClient';
import { obtenerConfiguracionPush, calcularEstadoLimitePush } from './pushConfigServicio';
import { obtenerTokensPorAspirantes } from './pushRegistroServicio';

/**
 * Envío de notificaciones push a aspirantes usando el servicio gratuito
 * de Expo Push (https://exp.host/--/api/v2/push/send).
 * Respeta el límite diario configurado en configuracion_push y registra
 * cada intento en historial_push (mismo patrón que correoServicio.ts).
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function registrarHistorial({
  titulo,
  cuerpo,
  estado,
  detalle,
  aspiranteIds,
}: {
  titulo: string;
  cuerpo: string;
  estado: 'enviado' | 'error' | 'omitido_por_limite';
  detalle?: string;
  aspiranteIds: number[];
}) {
  try {
    await supabase.from('historial_push').insert({
      titulo,
      cuerpo,
      estado,
      detalle: detalle ?? null,
      destinatarios: aspiranteIds.length,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Aviso: no se pudo registrar historial_push:', e);
  }
}

export async function enviarPushNotificacion({
  aspiranteIds,
  titulo,
  cuerpo,
  datos,
}: {
  aspiranteIds: number[];
  titulo: string;
  cuerpo: string;
  datos?: Record<string, any>;
}): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    if (!aspiranteIds?.length) {
      return { enviado: false, motivo: 'sin_destinatarios' };
    }

    // 1. Verificar límite diario antes de mandar nada.
    const config = await obtenerConfiguracionPush();
    const estadoLimite = calcularEstadoLimitePush(config);
    if (estadoLimite.excedido) {
      await registrarHistorial({
        titulo,
        cuerpo,
        estado: 'omitido_por_limite',
        detalle: `Límite diario (${estadoLimite.limiteDiario}) alcanzado.`,
        aspiranteIds,
      });
      return { enviado: false, motivo: 'limite_excedido' };
    }

    // 2. Obtener tokens Expo guardados para esos aspirantes.
    const tokens = await obtenerTokensPorAspirantes(aspiranteIds);
    if (!tokens.length) {
      await registrarHistorial({
        titulo,
        cuerpo,
        estado: 'omitido_por_limite',
        detalle: 'Ningún aspirante destinatario tiene token registrado.',
        aspiranteIds,
      });
      return { enviado: false, motivo: 'sin_tokens' };
    }

    // 3. Armar mensajes y mandarlos a Expo en lotes de 100 (límite de la API).
    const mensajes = tokens.map((to) => ({
      to,
      title: titulo,
      body: cuerpo,
      data: datos ?? {},
      sound: 'default',
    }));

    const lotes: typeof mensajes[] = [];
    for (let i = 0; i < mensajes.length; i += 100) {
      lotes.push(mensajes.slice(i, i + 100));
    }

    for (const lote of lotes) {
      const respuesta = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lote),
      });

      if (!respuesta.ok) {
        throw new Error(`Expo respondió con estado ${respuesta.status}`);
      }
    }

    // 4. Sumar al contador diario.
    try {
      await supabase.rpc('incrementar_contador_push', { cantidad: tokens.length });
    } catch (e) {
      console.warn('Aviso: no se pudo incrementar el contador de push:', e);
    }

    await registrarHistorial({ titulo, cuerpo, estado: 'enviado', aspiranteIds });
    return { enviado: true };
  } catch (e: any) {
    console.warn('Error en enviarPushNotificacion:', e);
    await registrarHistorial({
      titulo,
      cuerpo,
      estado: 'error',
      detalle: e?.message ?? String(e),
      aspiranteIds,
    });
    return { enviado: false, motivo: 'error' };
  }
}
