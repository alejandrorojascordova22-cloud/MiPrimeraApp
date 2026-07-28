import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";

/**
 * Gestión de la sesión de usuario (admin o aspirante) guardada en el
 * dispositivo. Migrado de lib/datos/sesion_local_service.dart.
 *
 * Usa AsyncStorage para guardar un JSON con los datos del usuario que
 * inició sesión, para no tener que volver a pedirlos cada vez que se
al abrir la app.
 */

const CLAVE_SESION_ASPIRANTE = "sesion_aspirante";
const CLAVE_SESION_ADMIN = "sesion_admin";

/**
 * Guarda los datos de un aspirante en la sesión local.
 * `datos` debe ser un objeto serializable a JSON.
 */
export async function guardarSesionAspirante(datos: Record<string, any>) {
  try {
    await AsyncStorage.setItem(CLAVE_SESION_ASPIRANTE, JSON.stringify(datos));
  } catch (error) {
    console.error("Error al guardar sesión de aspirante:", error);
  }
}

/**
 * Recupera los datos del aspirante de la sesión local.
 * Devuelve el objeto guardado, o null si no hay sesión.
 */
export async function obtenerSesionAspirante(): Promise<Record<
  string,
  any
> | null> {
  try {
    const json = await AsyncStorage.getItem(CLAVE_SESION_ASPIRANTE);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error("Error al obtener sesión de aspirante:", error);
    return null;
  }
}

/** Guarda los datos de un administrador en la sesión local. */
export async function guardarSesionAdmin(datos: Record<string, any>) {
  try {
    await AsyncStorage.setItem(CLAVE_SESION_ADMIN, JSON.stringify(datos));
  } catch (error) {
    console.error("Error al guardar sesión de admin:", error);
  }
}

/** Recupera los datos del administrador de la sesión local. */
export async function obtenerSesionAdmin(): Promise<Record<string, any> | null> {
  try {
    const json = await AsyncStorage.getItem(CLAVE_SESION_ADMIN);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error("Error al obtener sesión de admin:", error);
    return null;
  }
}

/** Cierra solo la sesión de administrador, sin afectar la de aspirante. */
export async function cerrarSesionAdmin() {
  try {
    await AsyncStorage.removeItem(CLAVE_SESION_ADMIN);
  } catch (error) {
    console.error("Error al cerrar sesión de admin:", error);
  }
}

/**
 * Limpia todas las sesiones guardadas (aspirante y admin).
 * Se llama al cerrar sesión o al cambiar de tipo de usuario.
 */
export async function cerrarTodasLasSesiones() {
  try {
    await AsyncStorage.multiRemove([
      CLAVE_SESION_ASPIRANTE,
      CLAVE_SESION_ADMIN,
    ]);
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Error al cerrar todas las sesiones:", error);
  }
}