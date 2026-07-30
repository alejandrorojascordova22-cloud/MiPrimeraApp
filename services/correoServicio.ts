import { supabase } from './supabaseClient';

/**
 * Envío del correo de confirmación de registro del aspirante (folio + carrera)
 * vía la Edge Function de Supabase `enviar-correo-aspirante`.
 * Migrado de la parte "correo" de lib/datos/supabase_service.dart
 */

interface ConstruirHtmlConfirmacionRegistroParams {
  nombre: string;
  correo: string;
  folio: string;
  carrera: string;
}

function construirHtmlConfirmacionRegistro({
  nombre,
  correo,
  folio,
  carrera,
}: ConstruirHtmlConfirmacionRegistroParams): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">✅ Registro Confirmado</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Examen de Admisión 2026</p>
          </div>
          <div style="padding: 40px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">¡Bienvenido, ${nombre}!</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">
              Tu registro ha sido confirmado exitosamente. Aquí están tus datos de acceso al examen.
            </p>
            <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
              <h3 style="color: #16a34a; margin: 0 0 15px 0;">Tus Datos de Acceso</h3>
              <div style="background-color: white; padding: 15px; border-radius: 4px; margin: 0 0 10px 0;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 3px 0; text-transform: uppercase;">FOLIO</p>
                <p style="color: #1f2937; font-size: 18px; font-weight: bold; margin: 0; font-family: 'Courier New', monospace;">${folio}</p>
              </div>
              <div style="background-color: white; padding: 15px; border-radius: 4px; margin: 0 0 10px 0;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 3px 0; text-transform: uppercase;">CARRERA</p>
                <p style="color: #1f2937; font-size: 16px; font-weight: bold; margin: 0;">${carrera}</p>
              </div>
              <div style="background-color: white; padding: 15px; border-radius: 4px; margin: 0 0 10px 0;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 3px 0; text-transform: uppercase;">CORREO REGISTRADO</p>
                <p style="color: #1f2937; font-size: 16px; font-weight: bold; margin: 0;">${correo}</p>
              </div>
              <p style="color: #4b5563; font-size: 13px; margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #dcfce7;">
                Guarda estos datos. Los necesitarás para acceder al examen.
              </p>
            </div>
          </div>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              © 2026 Universidad Tecnológica de Oriental. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

interface ConstruirHtmlResultadoParams {
  nombre: string;
  calificacion: number;
  aciertos: number;
  total: number;
  aprobado: boolean;
}

function construirHtmlResultado({
  nombre,
  calificacion,
  aciertos,
  total,
  aprobado,
}: ConstruirHtmlResultadoParams): string {
  const colorPrincipal = aprobado ? '#16a34a' : '#dc2626';
  const mensaje = aprobado
    ? 'Felicidades, has aprobado el examen de admisión.'
    : 'No alcanzaste la calificación mínima esta vez. Podrás intentarlo en el próximo período.';
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, ${colorPrincipal}, ${colorPrincipal}CC); padding: 40px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">📊 Resultado de tu Examen</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Examen de Admisión 2026</p>
          </div>
          <div style="padding: 40px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Hola, ${nombre}</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0;">${mensaje}</p>
            <div style="background-color: #f9fafb; border: 2px solid ${colorPrincipal}; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 20px 0;">
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase;">Calificación</p>
              <p style="color: ${colorPrincipal}; font-size: 40px; font-weight: bold; margin: 0;">${calificacion}%</p>
              <p style="color: #6b7280; font-size: 13px; margin: 8px 0 0 0;">${aciertos} de ${total} respuestas correctas</p>
            </div>
          </div>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              © 2026 Universidad Tecnológica de Oriental. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

interface EnviarCorreoResultadoParams {
  nombre: string;
  correo: string;
  calificacion: number;
  aciertos: number;
  total: number;
}

/**
 * Envía el correo con el resultado del examen (calificación, aciertos, aprobado o no).
 * Nota: no existía como Edge Function en la migración original (solo estaba la versión
 * vieja con SMTP directo en correo_servicio_real.dart); se agrega aquí usando la misma
 * Edge Function `enviar-correo-aspirante` que ya usa el registro, para mantener consistencia.
 */
export async function enviarCorreoResultado({
  nombre,
  correo,
  calificacion,
  aciertos,
  total,
}: EnviarCorreoResultadoParams): Promise<boolean> {
  try {
    const aprobado = calificacion >= 70;
    const { data, error } = await supabase.functions.invoke('enviar-correo-aspirante', {
      body: {
        nombre,
        correo,
        asunto: '📊 Resultados de tu Examen de Admisión - UT de Oriental 2026',
        mensaje_html: construirHtmlResultado({ nombre, calificacion, aciertos, total, aprobado }),
      },
    });

    const ok = !error && data && data.ok === true;
    if (!ok) {
      console.warn('enviarCorreoResultado: la función no envió el correo. Respuesta:', data, error);
    }
    return ok;
  } catch (e) {
    console.warn('Error al invocar enviar-correo-aspirante (resultado):', e);
    return false;
  }
}

interface EnviarCorreoConfirmacionRegistroParams {
  nombre: string;
  correo: string;
  folio: string;
  carrera: string;
}

/**
 * Llama a la Edge Function `enviar-correo-aspirante` para mandar el correo
 * de confirmación de registro con los datos de acceso (folio y carrera).
 * Devuelve true si la función respondió con ok:true, false en cualquier
 * otro caso (incluido "desactivado por el administrador" o "límite alcanzado").
 * Nunca lanza excepción hacia afuera: un fallo aquí no debe romper el registro.
 */
export async function enviarCorreoConfirmacionRegistro({
  nombre,
  correo,
  folio,
  carrera,
}: EnviarCorreoConfirmacionRegistroParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('enviar-correo-aspirante', {
      body: {
        nombre,
        correo,
        asunto: '✅ Registro Confirmado - Examen de Admisión 2026',
        mensaje_html: construirHtmlConfirmacionRegistro({ nombre, correo, folio, carrera }),
      },
    });

    const ok = !error && data && data.ok === true;

    if (!ok) {
      console.warn(
        'enviarCorreoConfirmacionRegistro: la función no envió el correo. Respuesta:',
        data,
        error
      );
    }

    return ok;
  } catch (e) {
    console.warn('Error al invocar enviar-correo-aspirante:', e);
    return false;
  }
}