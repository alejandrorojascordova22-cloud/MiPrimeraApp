import AsyncStorage from '@react-native-async-storage/async-storage';
import { aspiranteFromMap, type Aspirante } from '../types/aspirante';
import { supabase } from './supabaseClient';

/**
 * Centraliza el manejo de la sesión del usuario (aspirante o administrador),
 * para que las pantallas no tengan que pedir login cada vez que se abre la app.
 * Migrado de lib/datos/servicio_sesion.dart
 *
 * Nota: en Flutter usabas `SharedPreferences`; en React Native el equivalente
 * es `AsyncStorage` (ya lo tienes instalado, lo usa `supabaseClient.ts`).
 */

const KEY_ASPIRANTE = 'sesion_aspirante';
const KEY_ADMIN = 'sesion_admin';

// --- Métodos para Aspirante ---

export async function guardarSesionAspirante(
  aspiranteData: Record<string, any>
): Promise<void> {
  await AsyncStorage.setItem(KEY_ASPIRANTE, JSON.stringify(aspiranteData));
}

export async function obtenerSesionAspirante(): Promise<Aspirante | null> {
  const aspiranteJson = await AsyncStorage.getItem(KEY_ASPIRANTE);
  if (aspiranteJson == null) return null;
  const aspiranteMap = JSON.parse(aspiranteJson);
  return aspiranteFromMap(aspiranteMap);
}

export async function cerrarSesionAspirante(): Promise<void> {
  await AsyncStorage.removeItem(KEY_ASPIRANTE);
}

// --- Métodos para Administrador ---
// (En el Flutter original solo existía el de "obtener"; se agregan
// guardar/cerrar aquí porque login-admin.tsx los va a necesitar para
// funcionar simétrico al flujo de aspirante.)

export async function guardarSesionAdmin(adminData: Record<string, any>): Promise<void> {
  await AsyncStorage.setItem(KEY_ADMIN, JSON.stringify(adminData));
}

export async function obtenerSesionAdmin(): Promise<Record<string, any> | null> {
  const adminJson = await AsyncStorage.getItem(KEY_ADMIN);
  if (adminJson == null) return null;
  return JSON.parse(adminJson);
}

export async function cerrarSesionAdmin(): Promise<void> {
  await AsyncStorage.removeItem(KEY_ADMIN);
}

/**
 * Limpia AMBAS sesiones (admin y aspirante). Úsalo en cualquier logout
 * y también justo antes de guardar una sesión nueva de login, para
 * evitar el bug de "quedan las dos guardadas a la vez" (eso hacía que
 * la pantalla de login rebotara sola al panel/perfil sin pedir nada).
 */
export async function cerrarTodasLasSesiones(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_ASPIRANTE, KEY_ADMIN]);

  // También hay que cerrar la sesión ANÓNIMA de Supabase Auth que
  // `iniciarSesionAuthAdmin` deja abierta (y que, por tener
  // `persistSession: true`, sobrevive a reinicios de la app).
  // Si no se cierra aquí, esa sesión vieja se queda "colgada" — y si el
  // admin al que estaba ligada fue eliminado mientras tanto, cualquier
  // acción que dependa de auth.uid() (o un login futuro que intente
  // reusarla) puede fallar sin un error claro.
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Error al cerrar sesión de Supabase Auth:', e);
  }
}