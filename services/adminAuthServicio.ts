import { supabase } from './supabaseClient';

/**
 * Todo lo relacionado con los administradores del sistema (login-admin, ajustes).
 * Migrado de la parte "administradores" de lib/datos/supabase_service.dart
 */

/** Obtiene la lista de administradores del sistema. */
export async function obtenerAdministradores(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('administradores')
      .select()
      .order('id', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerAdministradores:', e);
    return [];
  }
}

interface ObtenerAdministradorPorUsuarioParams {
  correo: string;
}

/**
 * @deprecated Ya no se usa para el login (exponía el hash de la contraseña
 * al navegador). Se mantiene solo por si algo más de la app la usa para
 * consultar datos de un admin sin validar contraseña. Para login usa
 * `verificarLoginAdmin`.
 */
export async function obtenerAdministradorPorUsuario({
  correo,
}: ObtenerAdministradorPorUsuarioParams): Promise<Record<string, any> | null> {
  try {
    const { data: admin, error } = await supabase
      .from('administradores')
      .select()
      .ilike('correo', correo)
      .maybeSingle();
    if (error) throw error;
    return admin ?? null;
  } catch (e) {
    console.warn('Error en obtenerAdministradorPorUsuario:', e);
    return null;
  }
}

/**
 * Obtiene un administrador por su id (sin contraseña) para RE-VALIDAR una
 * sesión ya guardada localmente (AsyncStorage). Se usa al restaurar la
 * sesión al abrir la app: si el admin ya no existe o fue desactivado
 * (`activo: false`), la pantalla debe cerrar la sesión local y mandar de
 * vuelta al login, en vez de confiar ciegamente en los datos guardados en
 * el celular.
 */
export async function obtenerAdministradorPorId(
  id: number,
): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase
      .from('administradores')
      .select('id, nombre, correo, rol, activo')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  } catch (e) {
    console.warn('Error en obtenerAdministradorPorId:', e);
    return null;
  }
}

interface VerificarLoginAdminParams {
  correo: string;
  contrasena: string;
}

/**
 * Verifica el login de un administrador comparando la contraseña DENTRO de
 * la base de datos (función `verificar_login_admin`, con pgcrypto). El hash
 * de la contraseña nunca sale de Supabase hacia el navegador/celular, y por
 * lo mismo ya no depende de `crypto.subtle` (que solo funciona en https).
 *
 * Devuelve los datos del admin (sin la contraseña) si las credenciales son
 * correctas y la cuenta está activa; `null` si no.
 *
 * IMPORTANTE: esto por sí solo NO crea una sesión real de Supabase Auth
 * (auth.uid() seguirá siendo null). Para que las políticas RLS que dependen
 * de auth.uid() funcionen (p. ej. registrar asistencia por QR), después de
 * esto se debe llamar también a `iniciarSesionAuthAdmin`.
 */
export async function verificarLoginAdmin({
  correo,
  contrasena,
}: VerificarLoginAdminParams): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase.rpc('verificar_login_admin', {
      p_correo: correo.trim().toLowerCase(),
      p_contrasena: contrasena,
    });
    if (error) throw error;
    // El RPC regresa un arreglo (returns table); vacío = credenciales inválidas
    if (!data || data.length === 0) return null;
    return data[0];
  } catch (e) {
    console.warn('Error en verificarLoginAdmin:', e);
    return null;
  }
}

/**
 * Inicia una sesión REAL de Supabase Auth para el admin (usando login
 * anónimo) y la vincula a su fila en `administradores`, justo después de
 * que `verificarLoginAdmin` validó sus credenciales con tu sistema propio
 * (bcrypt).
 *
 * Esto es 100% automático: NO requiere crear usuarios a mano en
 * Authentication → Users. Cada login genera una sesión de Auth nueva y la
 * asocia al admin mediante el RPC `vincular_auth_admin` (ver script SQL).
 *
 * Gracias a esto, `auth.uid()` existe dentro de Postgres y las políticas
 * RLS que dependen de él (p. ej. en `asistencias`) funcionan correctamente.
 */
export async function iniciarSesionAuthAdmin(adminId: number): Promise<boolean> {
  try {
    const { error: errorAuth } = await supabase.auth.signInAnonymously();
    if (errorAuth) {
      console.warn('Error en signInAnonymously:', errorAuth.message);
      return false;
    }

    const { error: errorVinculo } = await supabase.rpc('vincular_auth_admin', {
      p_admin_id: adminId,
    });
    if (errorVinculo) {
      console.warn('Error en vincular_auth_admin:', errorVinculo.message);
      return false;
    }

    return true;
  } catch (e) {
    console.warn('Error en iniciarSesionAuthAdmin:', e);
    return false;
  }
}

/**
 * Todo lo de más abajo es nuevo (no existía en Flutter como funciones de
 * servicio; vivía embebido dentro de pantalla_ajustes_sistema.dart llamando
 * directo a Supabase.instance.client). Se migra aquí para que la pantalla
 * de Ajustes ("Panel de Administradores") pueda usarlo igual que el resto
 * de servicios.
 */

/** Lista los administradores secundarios (todos menos el rol 'maestro'). */
export async function obtenerAdministradoresSecundarios(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from('administradores')
      .select('id, nombre, correo, rol, activo, created_at')
      .neq('rol', 'maestro')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerAdministradoresSecundarios:', e);
    return [];
  }
}

/** Activa o desactiva el acceso de un administrador secundario. */
export async function actualizarActivoAdmin(id: number, activo: boolean): Promise<boolean> {
  try {
    const { error } = await supabase.from('administradores').update({ activo }).eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en actualizarActivoAdmin:', e);
    return false;
  }
}

/** Elimina definitivamente a un administrador secundario. */
export async function eliminarAdministrador(id: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('administradores')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      console.warn(`eliminarAdministrador: 0 filas afectadas para id ${id} (posible bloqueo de RLS).`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Error en eliminarAdministrador:', e);
    return false;
  }
}

interface CrearAdministradorParams {
  nombre: string;
  correo: string;
  /** Contraseña en texto plano: se hashea DENTRO de la base de datos (bcrypt vía pgcrypto). */
  contrasena: string;
  rol: 'administrador' | 'coordinador';
}

/**
 * Crea un nuevo administrador secundario mediante el RPC
 * `crear_administrador_seguro`, que genera el hash bcrypt en el servidor.
 * Antes esto se hacía con `hashContrasena` en el navegador, lo cual
 * requería un contexto seguro (https) para funcionar.
 */
export async function crearAdministrador({
  nombre,
  correo,
  contrasena,
  rol,
}: CrearAdministradorParams): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('crear_administrador_seguro', {
      p_nombre: nombre,
      p_correo: correo,
      p_contrasena: contrasena,
      p_rol: rol,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en crearAdministrador:', e);
    return false;
  }
}

interface ActualizarPerfilAdminParams {
  id: number;
  nombre?: string;
  avatarUrl?: string | null;
}

/** Actualiza nombre y/o avatar del administrador logueado ("Editar perfil"). */
export async function actualizarPerfilAdmin({
  id,
  nombre,
  avatarUrl,
}: ActualizarPerfilAdminParams): Promise<boolean> {
  try {
    const cambios: Record<string, any> = {};
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (avatarUrl !== undefined) cambios.avatar_url = avatarUrl?.trim() || null;
    if (Object.keys(cambios).length === 0) return true;

    const { error } = await supabase.from('administradores').update(cambios).eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en actualizarPerfilAdmin:', e);
    return false;
  }
}