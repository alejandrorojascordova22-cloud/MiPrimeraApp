import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

// Llave pública VAPID (segura de exponer en el cliente; la privada solo
// vive en los secrets de la Edge Function). Debe coincidir con la que
// configuraste con `supabase secrets set VAPID_PUBLIC_KEY=...`.
const VAPID_PUBLIC_KEY =
  'BBqIwpbFfHuHqmGZM4hjhbTAHxqp0GX8PV5NNg_vrwrf3mXnGof4RdoZ2TilfLKJ2E0Yz9lHLZEA2CaKvX1RqqI';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Registra el Service Worker y crea una suscripción de Web Push real,
 * guardándola en `push_suscripciones_web`. Esto es lo que permite que la
 * notificación llegue AUNQUE la pestaña/navegador esté cerrado (mientras
 * el navegador siga corriendo en el dispositivo) — a diferencia de
 * `mostrarNotificacionWeb`, que solo sirve con la pestaña abierta.
 */
export async function suscribirPushWeb(aspiranteId: number): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta Web Push (Service Worker/PushManager).');
    return false;
  }
  if (window.Notification.permission !== 'granted') return false;

  try {
    const registro = await navigator.serviceWorker.register('/sw.js');
    let suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          .buffer as ArrayBuffer,
      });
    }

    const json = suscripcion.toJSON();
    const { error } = await supabase.from('push_suscripciones_web').upsert(
      {
        aspirante_id: aspiranteId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error al suscribir push web:', e);
    return false;
  }
}

/**
 * Notificaciones nativas del NAVEGADOR (Web Notifications API), separadas
 * del push de Expo (que solo funciona en apps nativas/EAS y NO en web).
 * Con esto, cuando el admin publica un aviso, el navegador del aspirante
 * puede mostrar una notificación real (con sonido del sistema) aunque la
 * pestaña esté en segundo plano o minimizada — mientras el navegador siga
 * abierto. Si el navegador está cerrado por completo, esto no llega; eso
 * requeriría Web Push + Service Worker (proyecto aparte).
 */

/**
 * Genera un beep corto con Web Audio API. Esto es necesario porque
 * `Notification()` del navegador YA NO reproduce sonido por sí sola en
 * Chrome/Edge/Firefox modernos (quitaron esa función hace años); el sonido
 * de notificación del sistema operativo solo suena si el navegador está
 * en segundo plano/minimizado y el SO decide mostrarla como notificación
 * nativa (varía por SO). Para que suene consistente mientras la pestaña
 * está abierta (aunque no tenga el foco), lo generamos manualmente.
 */
function reproducirSonidoAviso() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Los navegadores bloquean audio si la página nunca tuvo un clic o
    // interacción del usuario (autoplay policy). No es un error grave:
    // sigue habiendo notificación visual, solo no suena.
    console.warn('No se pudo reproducir sonido de aviso (posible autoplay policy):', e);
  }
}

/** true solo si estamos en web y el navegador soporta Notification API. */
export function soportaNotificacionesWeb(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.Notification !== 'undefined'
  );
}

/** Estado actual del permiso: 'granted' | 'denied' | 'default' | null si no aplica. */
export function permisoNotificacionesWeb(): NotificationPermission | null {
  if (!soportaNotificacionesWeb()) return null;
  return window.Notification.permission;
}

/** Pide permiso al usuario (debe llamarse desde un gesto del usuario, ej. un botón). */
export async function pedirPermisoNotificacionesWeb(): Promise<NotificationPermission | null> {
  if (!soportaNotificacionesWeb()) return null;
  try {
    const resultado = await window.Notification.requestPermission();
    return resultado;
  } catch (e) {
    console.warn('Error al pedir permiso de notificaciones web:', e);
    return window.Notification.permission;
  }
}

/**
 * Muestra una notificación del navegador si hay permiso concedido.
 * No hace nada (silenciosamente) si no aplica o no hay permiso: nunca debe
 * romper el flujo que la llama.
 */
export function mostrarNotificacionWeb(
  titulo: string,
  opciones?: { cuerpo?: string; datos?: Record<string, any>; alHacerClick?: () => void }
) {
  if (!soportaNotificacionesWeb()) {
    console.warn('Notificaciones web: este navegador no las soporta.');
    return;
  }
  if (window.Notification.permission !== 'granted') {
    console.warn(
      `Notificaciones web: permiso actual = "${window.Notification.permission}". ` +
      'El aspirante debe aceptar el banner de "Activar notificaciones" primero.'
    );
    return;
  }

  reproducirSonidoAviso();

  try {
    const notif = new window.Notification(titulo, {
      body: opciones?.cuerpo,
      data: opciones?.datos,
      icon: '/favicon.png',
    });
    if (opciones?.alHacerClick) {
      notif.onclick = () => {
        window.focus();
        opciones.alHacerClick?.();
        notif.close();
      };
    }
  } catch (e) {
    console.warn('Error al mostrar notificación web:', e);
  }
}