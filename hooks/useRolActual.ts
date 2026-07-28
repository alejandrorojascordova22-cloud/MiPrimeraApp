import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { obtenerSesionAdmin, obtenerSesionAspirante } from '../services/sesionServicio';
import type { RolTema } from '../services/temaConfig';

/**
 * Detecta qué rol está usando la app en este momento (admin o aspirante),
 * revisando la sesión guardada en AsyncStorage. Se re-evalúa cada vez que
 * cambia la ruta, para que al hacer login/logout el tema se actualice solo.
 *
 * Reglas simples:
 * - Si hay sesión de admin guardada -> 'admin'
 * - Si no, si hay sesión de aspirante guardada -> 'aspirante'
 * - Si no hay ninguna (pantallas de login, registro, selección de carrera) ->
 *   se usa 'aspirante' como tema por defecto, ya que esas pantallas las ve
 *   público general, no administradores.
 */
export function useRolActual(): RolTema {
  const pathname = usePathname();
  const [rol, setRol] = useState<RolTema>('aspirante');

  useEffect(() => {
    let activo = true;

    (async () => {
      const sesionAdmin = await obtenerSesionAdmin();
      if (!activo) return;

      if (sesionAdmin) {
        setRol('admin');
        return;
      }

      const sesionAspirante = await obtenerSesionAspirante();
      if (!activo) return;

      setRol(sesionAspirante ? 'aspirante' : 'aspirante');
    })();

    return () => {
      activo = false;
    };
  }, [pathname]);

  return rol;
}
