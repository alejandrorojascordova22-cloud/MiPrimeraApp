/**
 * Modela una fila de `configuracion_tema` en Supabase (una por rol).
 * Representa todo lo personalizable desde Ajustes del Sistema sin tocar
 * código: modo claro/oscuro, colores, fondo y estilo visual.
 */

export type RolTema = 'admin' | 'aspirante';
export type ModoTema = 'claro' | 'oscuro' | 'auto';
export type FondoTipo = 'color' | 'gradiente' | 'imagen';
export type EstiloTarjeta = 'plano' | 'sombra' | 'glass';

export interface TemaConfig {
  rol: RolTema;
  modo: ModoTema;
  colorPrimario: string; // hex '#RRGGBB'
  colorSecundario: string;
  fondoTipo: FondoTipo;
  fondoColor: string;
  fondoGradienteInicio: string;
  fondoGradienteFin: string;
  fondoGradienteAnimado: boolean;
  fondoGradienteDuracionMs: number;
  fondoImagenUrl: string | null;
  fondoOpacidadOverlay: number;
  radioBordes: number;
  estiloTarjeta: EstiloTarjeta;
}

/** Valores por defecto = look actual de la app (fallback si Supabase falla). */
export function temaConfigPorDefecto(rol: RolTema = 'admin'): TemaConfig {
  return {
    rol,
    modo: 'claro',
    colorPrimario: '#0055A4',
    colorSecundario: '#6DFE9C',
    fondoTipo: 'color',
    fondoColor: '#F2F5FA',
    fondoGradienteInicio: '#040D2A',
    fondoGradienteFin: '#0D2461',
    fondoGradienteAnimado: false,
    fondoGradienteDuracionMs: 6000,
    fondoImagenUrl: null,
    fondoOpacidadOverlay: 0.55,
    radioBordes: 16,
    estiloTarjeta: 'sombra',
  };
}

function hex(v: string | null | undefined, fallback: string): string {
  if (!v || v.trim() === '') return fallback;
  let s = v.trim().replace('#', '');
  if (s.length === 6) s = `${s}`; // ya es RRGGBB, lo dejamos tal cual
  return `#${s}`;
}

/** Convierte la fila cruda de Supabase (snake_case) al objeto TemaConfig. */
export function temaConfigFromMap(m: Record<string, any>): TemaConfig {
  const rol: RolTema = (m.rol as RolTema) ?? 'admin';
  const d = temaConfigPorDefecto(rol);
  return {
    rol,
    modo: (m.modo as ModoTema) ?? d.modo,
    colorPrimario: hex(m.color_primario, d.colorPrimario),
    colorSecundario: hex(m.color_secundario, d.colorSecundario),
    fondoTipo: (m.fondo_tipo as FondoTipo) ?? d.fondoTipo,
    fondoColor: hex(m.fondo_color, d.fondoColor),
    fondoGradienteInicio: hex(m.fondo_gradiente_inicio, d.fondoGradienteInicio),
    fondoGradienteFin: hex(m.fondo_gradiente_fin, d.fondoGradienteFin),
    fondoGradienteAnimado: m.fondo_gradiente_animado ?? d.fondoGradienteAnimado,
    fondoGradienteDuracionMs: m.fondo_gradiente_duracion_ms ?? d.fondoGradienteDuracionMs,
    fondoImagenUrl:
      m.fondo_imagen_url && String(m.fondo_imagen_url).trim() !== ''
        ? (m.fondo_imagen_url as string)
        : null,
    fondoOpacidadOverlay: m.fondo_opacidad_overlay ?? d.fondoOpacidadOverlay,
    radioBordes: m.radio_bordes ?? d.radioBordes,
    estiloTarjeta: (m.estilo_tarjeta as EstiloTarjeta) ?? d.estiloTarjeta,
  };
}

/** Convierte TemaConfig de vuelta al formato snake_case que espera Supabase. */
export function temaConfigToMap(tema: TemaConfig): Record<string, any> {
  return {
    rol: tema.rol,
    modo: tema.modo,
    color_primario: tema.colorPrimario,
    color_secundario: tema.colorSecundario,
    fondo_tipo: tema.fondoTipo,
    fondo_color: tema.fondoColor,
    fondo_gradiente_inicio: tema.fondoGradienteInicio,
    fondo_gradiente_fin: tema.fondoGradienteFin,
    fondo_gradiente_animado: tema.fondoGradienteAnimado,
    fondo_gradiente_duracion_ms: tema.fondoGradienteDuracionMs,
    fondo_imagen_url: tema.fondoImagenUrl,
    fondo_opacidad_overlay: tema.fondoOpacidadOverlay,
    radio_bordes: tema.radioBordes,
    estilo_tarjeta: tema.estiloTarjeta,
  };
}

export function copyWithTema(
  base: TemaConfig,
  cambios: Partial<TemaConfig> & { borrarFondoImagenUrl?: boolean }
): TemaConfig {
  const { borrarFondoImagenUrl, ...resto } = cambios;
  return {
    ...base,
    ...resto,
    fondoImagenUrl: borrarFondoImagenUrl
      ? null
      : resto.fondoImagenUrl ?? base.fondoImagenUrl,
  };
}

export function esOscuro(tema: TemaConfig): boolean {
  return tema.modo === 'oscuro';
}