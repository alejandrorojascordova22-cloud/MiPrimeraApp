import { ConfirmProvider } from '@/components/ConfirmDialog';
import { FondoDinamico } from '@/components/FondoDinamico';
import { useRolActual } from '@/hooks/useRolActual';
import { useTemaControlador } from '@/hooks/useTemaControlador';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

/**
 * En el proyecto Flutter original CADA pantalla arma su propio Scaffold
 * (con o sin encabezado propio) — no existe un header global compartido
 * por toda la app. El header "¡Hola, Admin!" pertenece únicamente al
 * panel de administración (ver `_construirHeader()` en panel_admin.dart)
 * y ahora vive dentro de app/panel.tsx.
 *
 * Antes este layout forzaba ese mismo header de administrador arriba de
 * TODAS las rutas (incluido /login, que ya trae su propio encabezado
 * azul), lo que producía la doble cabecera fea que se veía en pantalla.
 * Por eso aquí ocultamos el header nativo por defecto: cada pantalla es
 * responsable de su propio diseño, igual que en Flutter.
 *
 * NUEVO: se detecta automáticamente si la sesión activa es de admin o
 * aspirante (useRolActual) y se envuelve todo el Stack en FondoDinamico
 * con el tema guardado para ese rol en Supabase (Ajustes del Sistema >
 * Apariencia). Así, lo que el admin configure en cada pestaña de rol se
 * ve reflejado de verdad en pantalla, no solo en el preview del modal.
 */
export default function RootStackLayout() {
  const rol = useRolActual();
  const { tema } = useTemaControlador(rol);

  return (
    <ConfirmProvider>
      <FondoDinamico tema={tema}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            // En web, la animación de transición entre pantallas deja un
            // residuo visual (un pedacito de la pantalla anterior pegado
            // arriba) mientras carga la siguiente. Desactivamos la
            // animación solo en web; en nativo (iOS/Android) se conserva.
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
      </FondoDinamico>
    </ConfirmProvider>
  );
}