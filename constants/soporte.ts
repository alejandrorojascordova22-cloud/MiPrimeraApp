// Número de WhatsApp de soporte para aspirantes, con código de país, sin
// espacios ni signos (ej. 521XXXXXXXXXX).
// TODO: reemplazar por el número real de soporte si cambia.
export const WHATSAPP_SOPORTE = "522202678971";

export const construirLinkWhatsappSoporte = (mensaje: string) =>
  `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(mensaje)}`;
