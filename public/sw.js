/**
 * Service Worker para Web Push real.
 *
 * Este archivo faltaba por completo en el proyecto. `suscribirPushWeb()`
 * (en services/webNotificacionesServicio.ts) hace
 * `navigator.serviceWorker.register('/sw.js')`, pero sin este archivo esa
 * suscripción nunca puede recibir push mientras la pestaña está cerrada:
 * es el propio Service Worker el que "despierta" en segundo plano y
 * muestra la notificación cuando llega un push del servidor.
 *
 * Debe vivir en la RAÍZ del sitio publicado (por eso va en /public/sw.js:
 * Expo Web con "output": "static" copia todo lo de /public/ tal cual a
 * la raíz del build).
 */

self.addEventListener('install', (event) => {
  // Activa este SW de inmediato, sin esperar a que se cierren otras pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Evento clave: llega cuando el servidor (nuestra Edge Function
 * `enviar-push-web`) manda un push real a través del navegador
 * (Chrome/Firefox/Edge), incluso con el navegador cerrado (mientras el
 * SO lo tenga registrado en segundo plano).
 */
self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = { title: 'Nuevo aviso', body: event.data ? event.data.text() : '' };
  }

  const titulo = datos.title || 'Nuevo aviso';
  const opciones = {
    body: datos.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: datos.data || {},
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

/** Al hacer clic en la notificación, enfoca o abre la app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});