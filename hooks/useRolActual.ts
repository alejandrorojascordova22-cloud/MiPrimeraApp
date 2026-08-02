import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { obtenerSesionAdmin, obtenerSesionAspirante } from '../services/sesionServicio';
import type { RolTema } from '../services/temaConfig';

/** Pantallas que SIEMPRE son de admin, sin importar sesiones guardadas. */
const RUTAS_ADMIN = [
  'panel',
  'ajustes-sistema',
  'gestionar-avisos',
  'gestionar-cronograma',
  'gestionar-materiales',
  'gestionar-preguntas',
  'carga-masiva',
  'carga-masiva-preguntas',
  'escaneo-qr',
  'codigo-qr',
  'vista-evaluaciones',
  'login-admin',
];

/** Pantallas que SIEMPRE son de aspirante, sin importar sesiones guardadas. */
const RUTAS_ASPIRANTE = [
  'login',
  'registro-aspirante',
  'seleccion-carrera',
  'perfil-aspirante',
  'documentos-aspirante',
  'avisos-aspirante',
  'ajustes-aspirante',
  'examen',
  'resultado',
];

/**
 * Detecta qué rol está usando la app en este momento (admin o aspirante).
 * Se re-evalúa cada vez que cambia la ruta.
 *
 * ---------------------------------------------------------------------
 * HISTORIAL DEL BUG QUE ARREGLA ESTA VERSIÓN:
 * Antes el rol se decidía SOLO revisando si existía una sesión de admin
 * guardada en AsyncStorage ("sesionAdmin ? 'admin' : 'aspirante'"), sin
 * mirar en qué pantalla estaba parado el usuario. Si el admin tenía su
 * sesión abierta y visitaba una pantalla de aspirante (para revisar cómo
 * se veía, por ejemplo "ajustes-aspirante"), el tema que se cargaba y
 * pintaba seguía siendo el de "admin". Por eso la imagen de fondo
 * configurada para Aspirante nunca se veía ahí: la app usaba, sin que
 * nadie lo notara, el tema de Admin incluso en pantallas de Aspirante.
 *
 * Ahora el nombre de la ruta manda primero: si la pantalla es
 * inequívocamente de admin o de aspirante, se usa ese rol directo. Solo
 * cuando la ruta es ambigua (por ejemplo la raíz "/") se cae de nuevo a
 * mirar qué sesión hay guardada.
 * ---------------------------------------------------------------------
 */
export function useRolActual(): RolTema {
  const pathname = usePathname();
  const [rol, setRol] = useState<RolTema>('aspirante');

  useEffect(() => {
    const segmento = pathname.split('/').filter(Boolean)[0] ?? '';

    if (RUTAS_ADMIN.includes(segmento)) {
      setRol('admin');
      return;
    }
    if (RUTAS_ASPIRANTE.includes(segmento)) {
      setRol('aspirante');
      return;
    }

    // Ruta ambigua (p. ej. "/"): se decide por la sesión guardada.
    let activo = true;
    (async () => {
      const sesionAdmin = await obtenerSesionAdmin();
      if (!activo) return;
      const sesionAspirante = await obtenerSesionAspirante();
      if (!activo) return;

      const siguienteRol = sesionAdmin ? 'admin' : 'aspirante';
      console.log('[DEBUG useRolActual] ruta ambigua, se usa sesión', {
        pathname,
        tieneSesionAdmin: Boolean(sesionAdmin),
        tieneSesionAspirante: Boolean(sesionAspirante),
        siguienteRol,
      });
      setRol(siguienteRol);
    })();

    return () => {
      activo = false;
    };
  }, [pathname]);

  return rol;
}