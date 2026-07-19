import React from 'react';
import { View, useWindowDimensions } from 'react-native';

/**
 * Utilidades centrales de responsividad para adaptar la app
 * a celulares, tablets y pantallas anchas (web/escritorio con Expo).
 *
 * Uso típico dentro de un componente:
 *   const { esMovil, valor } = useResponsivo();
 *   const columnas = valor({ movil: 1, tablet: 2, escritorio: 3 });
 */

// Breakpoints estándar (dp lógicos) — mismos valores que en Flutter
export const ANCHO_MOVIL = 600;
export const ANCHO_TABLET = 1024;
export const ANCHO_ESCRITORIO = 1440;

interface ValorOpciones<T> {
  movil: T;
  tablet?: T;
  escritorio?: T;
}

export function useResponsivo() {
  const { width, height } = useWindowDimensions();

  const esMovil = width < ANCHO_MOVIL;
  const esTablet = width >= ANCHO_MOVIL && width < ANCHO_TABLET;
  const esEscritorio = width >= ANCHO_TABLET;
  const esPantallaGrande = width >= ANCHO_ESCRITORIO;

  function valor<T>({ movil, tablet, escritorio }: ValorOpciones<T>): T {
    if (esEscritorio) return escritorio ?? tablet ?? movil;
    if (esTablet) return tablet ?? movil;
    return movil;
  }

  /** Escala un tamaño de fuente base según el ancho de pantalla. */
  function fuente(base: number): number {
    let factor = 1.0;
    if (width >= ANCHO_ESCRITORIO) factor = 1.15;
    else if (width >= ANCHO_TABLET) factor = 1.08;
    else if (width < 360) factor = 0.92;
    return base * factor;
  }

  /** Padding horizontal adaptable: más aire en pantallas grandes. */
  function paddingHorizontal(): number {
    return valor({ movil: 16, tablet: 32, escritorio: 64 });
  }

  /** Cantidad de columnas sugerida para grids según el ancho disponible. */
  function columnasGrid(anchoTarjeta = 280, minimo = 1, maximo = 6): number {
    const columnas = Math.floor(width / anchoTarjeta);
    return Math.min(Math.max(columnas, minimo), maximo);
  }

  return {
    width,
    height,
    esMovil,
    esTablet,
    esEscritorio,
    esPantallaGrande,
    valor,
    fuente,
    paddingHorizontal,
    columnasGrid,
  };
}

/**
 * Centra el contenido y limita su ancho máximo en pantallas grandes
 * (tablet/escritorio/web), evitando que formularios y listas se
 * estiren de borde a borde en monitores anchos.
 *
 * Uso: <ContenedorResponsivo><TuFormulario /></ContenedorResponsivo>
 */
interface ContenedorResponsivoProps {
  children: React.ReactNode;
  anchoMaximo?: number;
}

export function ContenedorResponsivo({
  children,
  anchoMaximo = 900,
}: ContenedorResponsivoProps) {
  const { paddingHorizontal } = useResponsivo();
  const padding = paddingHorizontal();

  return (
    <View
      style={{
        alignSelf: 'center',
        width: '100%',
        maxWidth: anchoMaximo,
        paddingLeft: padding,
        paddingRight: padding,
      }}
    >
      {children}
    </View>
  );
}
