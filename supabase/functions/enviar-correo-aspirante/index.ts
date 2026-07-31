// eslint-disable-next-line import/no-unresolved
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Inserta en historial_correos y SIEMPRE registra en el log de la función
  // si algo sale mal, en vez de tragarse el error como antes.
  async function registrarHistorial(datos: {
    destinatario: string;
    nombre_aspirante: string | null;
    tipo: string;
    asunto: string | null;
    estado: "omitido" | "error" | "enviado";
    error?: string;
    aspirante_id: number | null;
  }) {
    const { error } = await supabase.from("historial_correos").insert(datos);
    if (error) {
      console.error(
        "❌ Falló insert en historial_correos:",
        JSON.stringify(error),
        "fila intentada:",
        JSON.stringify(datos),
      );
    }
    return error
  }

  try {
    // tipo: 'confirmacion' (registro) | 'resultado'. Por compatibilidad,
    // si no se manda, se asume 'confirmacion' (comportamiento anterior).
    const { nombre, correo, asunto, mensaje_html, tipo, aspirante_id } = await req.json()
    const tipoCorreo: string = tipo || "confirmacion"

    if (!correo) {
      return new Response(
        JSON.stringify({ ok: false, error: "Falta el campo 'correo'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    await supabase.rpc("reiniciar_contador_si_es_nuevo_dia")

    const { data: config, error: configError } = await supabase
      .from("configuracion_correos")
      .select("*")
      .eq("id", 1)
      .single()

    if (configError || !config) {
      console.error("❌ No se pudo leer configuracion_correos:", JSON.stringify(configError))
      return new Response(
        JSON.stringify({ ok: false, error: "No se pudo leer la configuración" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!config.modo_automatico) {
      await registrarHistorial({
        destinatario: correo,
        nombre_aspirante: nombre ?? null,
        tipo: tipoCorreo,
        asunto: asunto,
        estado: "omitido",
        error: "Envío automático desactivado",
        aspirante_id: aspirante_id ?? null,
      })

      return new Response(
        JSON.stringify({ ok: false, error: "El envío automático está desactivado por el administrador" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Paso 3: toggle específico para correos de registro. Solo aplica
    // cuando tipoCorreo === 'confirmacion'; los de 'resultado' no se tocan.
    // config.registro_automatico_activo === false -> se pausa SOLO este tipo.
    if (tipoCorreo === "confirmacion" && config.registro_automatico_activo === false) {
      await registrarHistorial({
        destinatario: correo,
        nombre_aspirante: nombre ?? null,
        tipo: tipoCorreo,
        asunto: asunto,
        estado: "omitido",
        error: "Correo de registro desactivado (registro_automatico_activo = false)",
        aspirante_id: aspirante_id ?? null,
      })

      return new Response(
        JSON.stringify({ ok: false, error: "El correo de registro está desactivado por el administrador" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (config.correos_enviados_hoy >= config.limite_diario) {
      await registrarHistorial({
        destinatario: correo,
        nombre_aspirante: nombre ?? null,
        tipo: tipoCorreo,
        asunto: asunto,
        estado: "omitido",
        error: "Límite diario alcanzado",
        aspirante_id: aspirante_id ?? null,
      })

      return new Response(
        JSON.stringify({ ok: false, error: "Se alcanzó el límite diario de correos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const MAILTRAP_API_TOKEN = Deno.env.get("MAILTRAP_API_TOKEN")!
    const MAILTRAP_FROM_NAME = Deno.env.get("MAILTRAP_FROM_NAME")!
    const MAILTRAP_FROM_EMAIL = Deno.env.get("MAILTRAP_FROM_EMAIL")!

    const emailPayload = {
      from: { email: MAILTRAP_FROM_EMAIL, name: MAILTRAP_FROM_NAME },
      to: [{ email: correo }],
      subject: asunto || "Confirmación de registro - Aspirante",
      html:
        mensaje_html ||
        `<h2>¡Hola ${nombre || "aspirante"}!</h2>
         <p>Tu registro fue recibido correctamente.</p>
         <p>Pronto nos pondremos en contacto contigo.</p>`,
      category: "Registro Aspirante",
    }

    const mailtrapResponse = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAILTRAP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    })

    const mailtrapResult = await mailtrapResponse.json()

    if (!mailtrapResponse.ok) {
      await registrarHistorial({
        destinatario: correo,
        nombre_aspirante: nombre ?? null,
        tipo: tipoCorreo,
        asunto: asunto,
        estado: "error",
        error: JSON.stringify(mailtrapResult),
        aspirante_id: aspirante_id ?? null,
      })

      return new Response(
        JSON.stringify({ ok: false, error: "Error al enviar con Mailtrap", detalle: mailtrapResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    await supabase.rpc("incrementar_contador_correos")
    // Después de incrementar el contador, revisamos si hemos alcanzado
    // el umbral o el límite mensual para avisar a los administradores.
    try {
      const { data: confActual, error: confErr } = await supabase
        .from("configuracion_correos")
        .select("*")
        .eq("id", 1)
        .single();

      if (!confErr && confActual) {
        const enviadosMes = confActual.correos_enviados_mes_actual ?? 0;
        const limite = confActual.limite_mensual ?? confActual.limite_diario ?? null;
        const umbral = confActual.umbral_alerta ?? 80;

        const porcentaje = limite ? Math.round((enviadosMes / limite) * 100) : 0;

        if (limite && porcentaje >= umbral && !confActual.alerta_umbral_enviada) {
          // Marcar que ya enviamos la alerta por umbral y registrar notificación.
          await supabase
            .from("configuracion_correos")
            .update({ alerta_umbral_enviada: true, ultima_actualizacion: new Date().toISOString() })
            .eq("id", 1);

          await supabase.from("historial_notificaciones_admin").insert({
            titulo: "Alerta: umbral de envíos alcanzado",
            cuerpo: `Enviados ${enviadosMes}/${limite} correos (${porcentaje}%). Revisar campaña.`,
            nivel: "warning",
            fecha: new Date().toISOString(),
          });
        }

        if (limite && enviadosMes >= limite && !confActual.alerta_limite_enviada) {
          await supabase
            .from("configuracion_correos")
            .update({ alerta_limite_enviada: true, ultima_actualizacion: new Date().toISOString() })
            .eq("id", 1);

          await supabase.from("historial_notificaciones_admin").insert({
            titulo: "Límite de correos alcanzado",
            cuerpo: `Se alcanzó el límite de ${limite} correos para el mes. No se enviarán más correos automáticos.`,
            nivel: "error",
            fecha: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("Aviso: no se pudo comprobar/enviar notificación admin:", e);
    }

    const historialError = await registrarHistorial({
      destinatario: correo,
      nombre_aspirante: nombre ?? null,
      tipo: tipoCorreo,
      asunto: asunto,
      estado: "enviado",
      aspirante_id: aspirante_id ?? null,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: "Correo enviado correctamente",
        detalle: mailtrapResult,
        // Si el insert al historial falló, lo mandamos en la respuesta
        // también para que sea imposible no darse cuenta durante pruebas.
        aviso_historial: historialError ? JSON.stringify(historialError) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("❌ Error inesperado en enviar-correo-aspirante:", err)
    return new Response(
      JSON.stringify({ ok: false, error: "Error inesperado", detalle: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})