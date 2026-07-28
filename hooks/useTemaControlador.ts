import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  TemaConfig,
  RolTema,
  temaConfigPorDefecto,
  esOscuro as esOscuroTema,
} from '../services/temaConfig';
import {
  obtenerTema,
  guardarTema,
  escucharTema,
} from '../services/temaConfigServicio';

/**
 * Hook de apariencia del sistema, ahora por rol (admin, aspirante, evaluador).
 *
 * - Carga el tema del rol indicado desde Supabase al montar.
 * - Se suscribe a realtime SOLO para ese rol: si el admin cambia el tema de
 *   "aspirante", únicamente los dispositivos de aspirantes lo reciben en vivo.
 * - Expone `guardar()` con actualización optimista (igual que antes).
 *
 * Uso típico:
 *   const { tema, guardar } = useTemaControlador('aspirante');
 *
 * En Ajustes del Sistema (admin editando los 3 temas), se llama una vez por
 * pestaña seleccionada, pasando el rol activo en ese momento.
 */
export function useTemaControlador(rol: RolTema) {
  const [tema, setTema] = useState<TemaConfig>(temaConfigPorDefecto(rol));
  const [cargando, setCargando] = useState(true);
  const canalRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let activo = true;

    (async () => {
      setCargando(true);
      const inicial = await obtenerTema(rol);
      if (!activo) return;
      setTema(inicial);
      setCargando(false);

      try {
        canalRef.current?.unsubscribe();
        canalRef.current = escucharTema(rol, (nuevo) => {
          if (activo) setTema(nuevo);
        });
      } catch {
        // Si falla realtime (p. ej. tabla aún no migrada) la app sigue
        // funcionando con el tema cargado inicialmente.
      }
    })();

    return () => {
      activo = false;
      canalRef.current?.unsubscribe();
    };
  }, [rol]);

  /** Guarda en Supabase y actualiza localmente de inmediato (optimista). */
  const guardar = useCallback(async (nuevo: TemaConfig) => {
    const anterior = tema;
    setTema(nuevo);
    const ok = await guardarTema(nuevo);
    if (!ok) setTema(anterior);
    return ok;
  }, [tema]);

  return {
    tema,
    cargando,
    guardar,
    esOscuro: esOscuroTema(tema),
  };
}