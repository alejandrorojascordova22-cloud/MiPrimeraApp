import { supabase } from './supabaseClient';

/** Servicio mínimo para notificaciones dirigidas a administradores.
 *  Actualmente registra las alertas en una tabla `historial_notificaciones_admin`.
 *  Puedes ampliar para invocar una Edge Function que entregue push/email.
 */

export async function registrarNotificacionAdmin({
  titulo,
  cuerpo,
  nivel = 'info',
}: {
  titulo: string;
  cuerpo: string;
  nivel?: 'info' | 'warning' | 'error';
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('historial_notificaciones_admin').insert({
      titulo,
      cuerpo,
      nivel,
      fecha: new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('No se pudo registrar notificacion admin:', e);
    return false;
  }
}

export async function enviarAlertaUmbralAdmin({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  // Registro local en historial. Si en el futuro se quiere enviar por push/email,
  // aquí se puede invocar una Edge Function o un servicio externo.
  await registrarNotificacionAdmin({ titulo, cuerpo, nivel: 'warning' });
  return true;
}
