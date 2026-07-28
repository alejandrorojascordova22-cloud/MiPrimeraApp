// Edge Function: enviar-push-web
//
// El cliente (app/gestionar-avisos.tsx) ya llama a
// `supabase.functions.invoke('enviar-push-web', { body: {...} })` al
// publicar un aviso, pero esta función no existía en el proyecto: por eso
// la suscripción se guardaba en `push_suscripciones_web` (vía
// suscribirPushWeb) pero nunca se mandaba ningún push real, y por eso los
// aspirantes solo recibían el aviso si tenían la pestaña abierta
// (mostrarNotificacionWeb, que depende de Realtime).
//
// Esta función SÍ manda el push real a través del navegador, aunque el
// aspirante tenga el sistema/pestaña cerrados.
//
// Despliegue:
//   supabase functions deploy enviar-push-web
//
// Secrets necesarios (una sola vez):
//   supabase secrets set VAPID_PUBLIC_KEY="BPFYX8NfVBlJXpg0mU8M8Coc7V8sbzwmF6UMLbR5CjppRkRkU2mVVZKZvD5EWg_Evln1jnJQFamT37X3TBGTGcs"
//   supabase secrets set VAPID_PRIVATE_KEY="<tu clave privada VAPID>"
//   supabase secrets set VAPID_SUBJECT="mailto:tu-correo@dominio.com"
//
// Si aún no tienes un par de claves VAPID, genera uno nuevo con:
//   npx web-push generate-vapid-keys
// y actualiza también VAPID_PUBLIC_KEY en
// services/webNotificacionesServicio.ts para que coincida.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:soporte@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { aspiranteIds, titulo, cuerpo, datos } = await req.json();

    if (!Array.isArray(aspiranteIds) || aspiranteIds.length === 0) {
      return new Response(JSON.stringify({ enviado: false, motivo: 'sin_destinatarios' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Traer todas las suscripciones web de esos aspirantes.
    const { data: suscripciones, error } = await supabaseAdmin
      .from('push_suscripciones_web')
      .select('id, endpoint, p256dh, auth')
      .in('aspirante_id', aspiranteIds);

    if (error) throw error;

    if (!suscripciones || suscripciones.length === 0) {
      return new Response(JSON.stringify({ enviado: false, motivo: 'sin_suscripciones' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: titulo,
      body: cuerpo,
      data: datos ?? {},
    });

    // 2. Mandar el push a cada suscripción. Si una suscripción ya no es
    //    válida (410/404 = el navegador la eliminó), la borramos para no
    //    seguir intentando en el futuro.
    const resultados = await Promise.allSettled(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payload
          );
          return { id: s.id, ok: true };
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabaseAdmin.from('push_suscripciones_web').delete().eq('id', s.id);
          }
          throw err;
        }
      })
    );

    const enviados = resultados.filter((r) => r.status === 'fulfilled').length;
    const fallidos = resultados.length - enviados;

    return new Response(
      JSON.stringify({ enviado: enviados > 0, enviados, fallidos }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Error en enviar-push-web:', e);
    return new Response(JSON.stringify({ enviado: false, motivo: 'error', detalle: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});