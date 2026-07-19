import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Pide permiso de notificaciones al usuario y devuelve el token de Expo
 * Push para este dispositivo, o null si no fue posible obtenerlo
 * (emulador, permiso negado, o falta el projectId de EAS en app.json).
 */
export async function obtenerTokenPushDispositivo(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push: los emuladores no reciben push notifications, usa un dispositivo físico.');
      return null;
    }

    const { status: estadoActual } = await Notifications.getPermissionsAsync();
    let estadoFinal = estadoActual;

    if (estadoActual !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      estadoFinal = status;
    }

    if (estadoFinal !== 'granted') {
      console.warn('Push: el usuario no otorgó permiso de notificaciones.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('Push: falta extra.eas.projectId en app.json, no se puede generar el token.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.warn('Error en obtenerTokenPushDispositivo:', e);
    return null;
  }
}
