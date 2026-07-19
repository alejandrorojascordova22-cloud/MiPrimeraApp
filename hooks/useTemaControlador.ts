import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  TemaConfig,
  temaConfigPorDefecto,
  esOscuro as esOscuroTema,
} from '../services/temaConfig';
import {
  obtenerTema,
  guardarTema,
  escucharTema,
} from '../services/temaConfigServicio';

/**
 * Hook global de apariencia del sistema (equivalente a TemaControlador).
 *
 * - Carga el tema desde Supabase al montar.
 * - Se suscribe a realtime: si un admin cambia el tema desde Ajustes del
 *   Sistema, todos los dispositivos lo reciben en vivo, sin recargar la app.
 * - Expone `guardar()` con actualización optimista (igual que en Flutter).
 *
 * Uso típico, una sola vez arriba del árbol (por ejemplo en app/_layout.tsx),
 * guardando el resultado en un Context para que todas las pantallas lo lean.
 */
export function useTemaControlador() {
  const [tema, setTema] = useState<TemaConfig>(temaConfigPorDefecto());
  const [cargando, setCargando] = useState(true);
  const canalRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let activo = true;

    (async () => {
      const inicial = await obtenerTema();
      if (!activo) return;
      setTema(inicial);
      setCargando(false);

      try {
        canalRef.current = escucharTema((nuevo) => {
          if (activo) setTema(nuevo);
        });
      } catch {
        // Si falla realtime (p. ej. tabla aún no existe) la app sigue
        // funcionando con el tema cargado inicialmente.
      }
    })();

    return () => {
      activo = false;
      canalRef.current?.unsubscribe();
    };
  }, []);

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
