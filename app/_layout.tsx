import { ConfirmProvider } from "@/components/ConfirmDialog";
import { FondoDinamico } from "@/components/FondoDinamico";
import { useRolActual } from "@/hooks/useRolActual";
import { TemaProvider } from "@/hooks/useTema";
import { useTemaControlador } from "@/hooks/useTemaControlador";
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router/react-navigation";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * BUG RESUELTO: la imagen/gradiente de fondo (FondoDinamico) se veía
 * tapada por un gris sólido rgb(242, 242, 242) en TODAS las pantallas
 * (se notaba más en /perfil-aspirante). Ese gris NO viene de nuestro
 * código: es `DefaultTheme.colors.background` del tema de navegación que
 * expo-router administra por debajo del <Stack>. Como nunca le dimos un
 * theme propio, usa ese gris de fábrica y lo pinta en el contenedor
 * interno de cada pantalla — una capa distinta a `contentStyle`, así que
 * `contentStyle: { backgroundColor: "transparent" }` en screenOptions NO
 * alcanza a taparlo. La solución es forzar `colors.background:
 * "transparent"` en el tema de navegación mismo.
 *
 * IMPORTANTE (Expo SDK 56+): expo-router ya NO permite importar
 * `ThemeProvider`/`DefaultTheme` desde "@react-navigation/native"
 * directamente en código de la app (se separaron los paquetes). Hay que
 * importarlos desde "expo-router/react-navigation" en su lugar — la API
 * en tiempo de ejecución es idéntica, solo cambia de dónde se importa.
 */
const temaNavegacionTransparente = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

/**
 * En web, `flex: 1` en <FondoDinamico> (y en cualquier View de la app)
 * solo funciona si TODA la cadena de contenedores padres tiene altura
 * real: html -> body -> #root -> ... Por defecto esos elementos no
 * tienen altura explícita, así que `flex: 1` colapsa a 0px y el fondo
 * dinámico no se pinta (aunque el resto de la app se vea bien porque el
 * contenido normal no depende de esa altura). Esto se fuerza una sola
 * vez al montar, solo en web.
 */
function useAlturaCompletaWeb() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const estilo = document.createElement("style");
    estilo.textContent = `
      html, body, #root {
        height: 100%;
        background-color: transparent !important;
      }
      body, #root {
        background: transparent !important;
      }
    `;
    document.head.appendChild(estilo);
    return () => {
      document.head.removeChild(estilo);
    };
  }, []);
}

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
  useAlturaCompletaWeb();

  console.log("[DEBUG RootStackLayout] rol y tema", {
    rol,
    fondoTipo: tema.fondoTipo,
    fondoImagenUrl: tema.fondoImagenUrl,
    fondoColor: tema.fondoColor,
  });

  return (
    <ConfirmProvider>
      <TemaProvider tema={tema}>
        <FondoDinamico tema={tema}>
          <NavigationThemeProvider value={temaNavegacionTransparente}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
                // En web, la animación de transición entre pantallas deja un
                // residuo visual (un pedacito de la pantalla anterior pegado
                // arriba) mientras carga la siguiente. Desactivamos la
                // animación solo en web; en nativo (iOS/Android) se conserva.
                animation:
                  typeof window !== "undefined" && typeof document !== "undefined"
                    ? "none"
                    : "default",
              }}
            />
          </NavigationThemeProvider>
        </FondoDinamico>
      </TemaProvider>
    </ConfirmProvider>
  );
}