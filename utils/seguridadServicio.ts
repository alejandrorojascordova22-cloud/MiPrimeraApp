import * as Crypto from 'expo-crypto';

/**
 * Hash y validación de contraseñas, compatible con SHA-256.
 * Migrado de lib/datos/seguridad_servicio.dart
 *
 * Requiere: npx expo install expo-crypto
 *
 * Diferencia importante con Dart: ahí `hashContrasena` era síncrona.
 * Aquí `expo-crypto` es asíncrona (usa el sistema operativo para hashear),
 * así que todas estas funciones regresan una Promise.
 */

/** Genera un hash SHA-256 de una contraseña. */
export async function hashContrasena(contrasena: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, contrasena);
}

/** Verifica que una contraseña coincida con su hash SHA-256. */
export async function verificarContrasena(
  contrasenaIngresada: string,
  hashAlmacenado: string
): Promise<boolean> {
  try {
    const hashIngresado = await hashContrasena(contrasenaIngresada);
    return hashIngresado === hashAlmacenado;
  } catch {
    return false;
  }
}

/** Valida que una contraseña sea fuerte. */
export function esContraseniaFuerte(contrasena: string): boolean {
  if (contrasena.length < 8) return false;
  if (!/[A-Z]/.test(contrasena)) return false;
  if (!/[0-9]/.test(contrasena)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(contrasena)) return false;
  return true;
}

/** Obtiene feedback sobre la fortaleza de la contraseña. */
export function obtenerFeedbackContrasena(contrasena: string): string {
  if (contrasena.length === 0) return 'La contraseña no puede estar vacía';
  if (contrasena.length < 8) return 'Mínimo 8 caracteres requeridos';
  if (!/[A-Z]/.test(contrasena)) return 'Añade una mayúscula';
  if (!/[0-9]/.test(contrasena)) return 'Añade un número';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(contrasena)) {
    return 'Añade un carácter especial (!@#$%^&*)';
  }
  return 'Contraseña fuerte ✓';
}
