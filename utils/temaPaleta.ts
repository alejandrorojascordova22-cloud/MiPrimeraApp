/**
 * Deriva una paleta completa de colores de UI (fondo de tarjetas, sidebar,
 * texto secundario, bordes, etc.) a partir del `TemaConfig` que el admin
 * configura en Ajustes del Sistema > Apariencia.
 *
 * Antes, pantallas como `perfil-aspirante.tsx` tenían su propia constante
 * `theme` fija (colores morados/hexadecimales escritos a mano), totalmente
 * desconectada de lo que se guarda en Supabase. Por eso cambiar el color
 * primario de "aspirante" en Ajustes del Sistema no se reflejaba ahí: la
 * pantalla nunca leía esos valores, tenía los suyos propios.
 *
 * Esta paleta sí parte de `tema.colorPrimario`, `tema.colorSecundario`,
 * `tema.colorTexto` y `tema.fondoColor` (los mismos campos que edita el
 * selector visual de color), y solo deja fijos los colores semánticos que
 * no tiene sentido personalizar (verde de éxito, rojo de error, amarillo de
 * advertencia), igual que hace cualquier sistema de diseño.
 */

import type { TemaConfig } from '@/services/temaConfig';

function hexARgb(hex: string): { r: number; g: number; b: number } {
  const limpio = hex.replace('#', '');
  const bigint = parseInt(limpio, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbAHex(r: number, g: number, b: number): string {
  const a = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${a(r)}${a(g)}${a(b)}`.toUpperCase();
}

/** Mezcla un color hex con blanco (porcentaje > 0, aclara) o negro (porcentaje < 0, oscurece). */
export function mezclarHex(hexColor: string, porcentaje: number): string {
  if (!/^#([0-9A-Fa-f]{6})$/.test(hexColor)) return hexColor;
  const { r, g, b } = hexARgb(hexColor);
  const objetivo = porcentaje > 0 ? 255 : 0;
  const p = Math.abs(porcentaje);
  const mezclar = (canal: number) => canal + (objetivo - canal) * p;
  return rgbAHex(mezclar(r), mezclar(g), mezclar(b));
}

/** Devuelve el color con transparencia en formato rgba(), para fondos suaves tipo "chip". */
export function hexConAlpha(hexColor: string, alpha: number): string {
  if (!/^#([0-9A-Fa-f]{6})$/.test(hexColor)) return hexColor;
  const { r, g, b } = hexARgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** true si el color es "claro" (conviene texto oscuro encima). */
export function esColorClaro(hexColor: string): boolean {
  if (!/^#([0-9A-Fa-f]{6})$/.test(hexColor)) return true;
  const { r, g, b } = hexARgb(hexColor);
  // Luminancia percibida (fórmula estándar YIQ).
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export interface PaletaAspirante {
  bgApp: string;
  blanco: string;
  negro: string;
  texto: string;
  textoSecundario: string;
  textoTerciario: string;
  borde: string;
  fondoSuave: string;
  morado: string;
  moradoOscuro: string;
  moradoClaro: string;
  moradoFondo: string;
  sidebarBg: string;
  sidebarBgAlt: string;
  sidebarTexto: string;
  sidebarTextoActivo: string;
  sidebarBorde: string;
  teal: string;
  tealFondo: string;
  verde: string;
  verdeFondo: string;
  verdeBorde: string;
  amarillo: string;
  amarilloFondo: string;
  amarilloBorde: string;
  rojo: string;
  rojoFondo: string;
  rojoBorde: string;
  gris: string;
}

/**
 * Construye la paleta de `perfil-aspirante.tsx` desde el tema real.
 * Los colores semánticos (verde/rojo/amarillo/teal) se mantienen fijos por
 * diseño; el resto sí sigue lo que el admin configuró para el rol aspirante.
 */
export function construirPaletaAspirante(tema: TemaConfig): PaletaAspirante {
  const primario = tema.colorPrimario || '#7C3AED';
  const secundario = tema.colorSecundario || '#9061F9';
  const texto = tema.colorTexto || '#1E1B29';
  const fondoBase =
    tema.fondoTipo === 'color' && tema.fondoColor ? tema.fondoColor : '#F5F3FB';

  return {
    bgApp: fondoBase,
    blanco: '#FFFFFF',
    negro: '#0F0D17',

    texto,
    textoSecundario: mezclarHex(texto, 0.45),
    textoTerciario: mezclarHex(texto, 0.65),

    borde: mezclarHex(texto, 0.9),
    fondoSuave: mezclarHex(primario, 0.94),

    morado: primario,
    moradoOscuro: mezclarHex(primario, -0.2),
    moradoClaro: secundario,
    moradoFondo: mezclarHex(primario, 0.92),

    // El sidebar se mantiene oscuro (buen contraste con el logo/ícono
    // blanco) pero teñido con el color primario elegido, en vez de un
    // morado fijo, para que sí refleje la marca configurada.
    sidebarBg: mezclarHex(primario, -0.82),
    sidebarBgAlt: mezclarHex(primario, -0.76),
    sidebarTexto: 'rgba(255,255,255,0.7)',
    sidebarTextoActivo: '#FFFFFF',
    sidebarBorde: 'rgba(255,255,255,0.06)',

    teal: '#0E9BA8',
    tealFondo: '#DCFAFB',

    verde: '#16A34A',
    verdeFondo: '#DCFCE7',
    verdeBorde: '#BBF0CE',
    amarillo: '#D97706',
    amarilloFondo: '#FDF3E1',
    amarilloBorde: '#F3DFAF',
    rojo: '#DC2626',
    rojoFondo: '#FBEAEA',
    rojoBorde: '#F2C6C6',
    gris: '#9C97AC',
  };
}
