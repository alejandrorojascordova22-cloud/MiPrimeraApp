import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import type { TemaConfig } from "../services/temaConfig";

/**
 * Envuelve una pantalla completa y pinta el fondo configurado en
 * Ajustes del Sistema (color sólido, degradado —animado u opcionalmente
 * estático— o imagen con overlay), según el rol activo.
 * Se actualiza solo cuando cambia `tema` (viene del hook useTemaControlador
 * vía Context), sin necesidad de tocar código ni recompilar la app.
 *
 * Requiere: npx expo install expo-linear-gradient
 *
 * Uso típico:
 * <FondoDinamico tema={tema}>
 *   <View style={{ flex: 1 }}>...</View>
 * </FondoDinamico>
 *
 * ---------------------------------------------------------------------
 * HISTORIAL DEL BUG QUE ARREGLA ESTE ARCHIVO (para no repetir el mismo
 * diagnóstico si vuelve a pasar algo parecido):
 *
 * 1) La versión original envolvía TODO el árbol con `flex: 1`
 *    (LinearGradient/ImageBackground como wrapper). En web eso depende de
 *    que TODA la cadena de contenedores padres tenga altura explícita; si
 *    algún wrapper intermedio no la tiene, el fondo colapsa a 0px de alto
 *    y no se pinta (aunque la imagen sí llegue a descargarse).
 * 2) Se probó sacar el fondo del árbol de React con un PORTAL
 *    (`ReactDOM.createPortal` directo a `document.body`, con
 *    `position: fixed` + `zIndex: -1`). Esto rompió TODO en pantallas que
 *    no envuelven su propio contenido de forma transparente hasta la
 *    raíz: como el fondo queda literalmente detrás de `<body>` con
 *    zIndex negativo, CUALQUIER contenedor ancestro de la app con fondo
 *    opaco (aunque sea heredado del navegador) lo tapa por completo. Es
 *    lo que pasaba en /perfil-aspirante (fondo invisible) mientras
 *    "funcionaba" en /panel solo porque esa pantalla tenía SU PROPIA
 *    copia adicional de <FondoDinamico> anidada más adentro del árbol.
 * 3) Solución final: nada de portales. El fondo se pinta como el PRIMER
 *    hijo normal de este mismo componente (dentro del árbol de React,
 *    no fuera de él), usando `position: absolute` + `StyleSheet.absoluteFill`
 *    relativo a este `<View style={{ flex: 1 }}>`. Para que eso funcione
 *    en web sin colapsar a 0px de alto, `_layout.tsx` fuerza
 *    `height: 100%` en `html`, `body` y el div raíz una sola vez al
 *    montar (ver ese archivo). Así el fondo SIEMPRE se pinta relativo a
 *    su propio contenedor, sin depender de trucos de portal ni de que
 *    cada pantalla lo repita por su cuenta.
 * ---------------------------------------------------------------------
 */
interface FondoDinamicoProps {
  tema: TemaConfig;
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * `true` (por defecto): la capa de fondo usa `position: fixed` en web,
   * ideal para cuando este componente envuelve TODA la app (ver
   * app/_layout.tsx y app/panel.tsx) — así no depende de que la cadena de
   * contenedores padres tenga altura real.
   *
   * `false`: la capa de fondo usa `position: absolute` normal, confinada
   * a ESTE contenedor (respeta su tamaño y su `overflow: hidden`). Úsalo
   * cuando FondoDinamico se reutiliza dentro de una cajita pequeña, como
   * la vista previa en vivo de Apariencia del Sistema — con `fixed` esa
   * cajita se ignoraba por completo y el fondo se pintaba sobre TODA la
   * ventana del navegador, tapando el resto de la pantalla.
   */
  fijarAlViewport?: boolean;
}

const GradienteAnimado = Animated.createAnimatedComponent(LinearGradient);

export function FondoDinamico({
  tema,
  children,
  style,
  fijarAlViewport = true,
}: FondoDinamicoProps) {
  const [progreso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (tema.fondoTipo !== "gradiente" || !tema.fondoGradienteAnimado) return;

    const animacion = Animated.loop(
      Animated.sequence([
        Animated.timing(progreso, {
          toValue: 1,
          duration: tema.fondoGradienteDuracionMs,
          useNativeDriver: false,
        }),
        Animated.timing(progreso, {
          toValue: 0,
          duration: tema.fondoGradienteDuracionMs,
          useNativeDriver: false,
        }),
      ]),
    );

    animacion.start();
    return () => animacion.stop();
  }, [
    tema.fondoTipo,
    tema.fondoGradienteAnimado,
    tema.fondoGradienteDuracionMs,
    progreso,
  ]);
  // En web podemos pintar el <body> para garantizar que el fondo sea
  // visible incluso si el árbol de React tiene contenedores opacos.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!fijarAlViewport) return;

    const body = document.body;
    const html = document.documentElement;
    const previo = {
      backgroundImage: body.style.backgroundImage,
      backgroundSize: body.style.backgroundSize,
      backgroundPosition: body.style.backgroundPosition,
      backgroundRepeat: body.style.backgroundRepeat,
      backgroundColor: body.style.backgroundColor,
    };

    if (tema.fondoTipo === "imagen" && tema.fondoImagenUrl) {
      body.style.backgroundImage = `url("${tema.fondoImagenUrl}")`;
      body.style.backgroundSize = "cover";
      body.style.backgroundPosition = "center";
      body.style.backgroundRepeat = "no-repeat";
      body.style.backgroundColor = tema.fondoColor;
      html.style.backgroundColor = tema.fondoColor;
      console.log("[DEBUG FondoDinamico] aplicando background en body", {
        url: tema.fondoImagenUrl,
        fondoColor: tema.fondoColor,
      });
    } else if (tema.fondoTipo === "color") {
      body.style.backgroundImage = "";
      body.style.backgroundColor = tema.fondoColor;
      html.style.backgroundColor = tema.fondoColor;
      console.log("[DEBUG FondoDinamico] aplicando color en body", {
        fondoColor: tema.fondoColor,
      });
    } else {
      body.style.backgroundImage = "";
      body.style.backgroundColor = previo.backgroundColor;
      html.style.backgroundColor = previo.backgroundColor;
      console.log("[DEBUG FondoDinamico] restaurando body a previo", {
        previo,
      });
    }

    return () => {
      body.style.backgroundImage = previo.backgroundImage;
      body.style.backgroundSize = previo.backgroundSize;
      body.style.backgroundPosition = previo.backgroundPosition;
      body.style.backgroundRepeat = previo.backgroundRepeat;
      body.style.backgroundColor = previo.backgroundColor;
      html.style.backgroundColor = previo.backgroundColor;
    };
  }, [tema.fondoTipo, tema.fondoImagenUrl, tema.fondoColor, fijarAlViewport]);

  let capaFondo: React.ReactNode = null;

  if (tema.fondoTipo === "gradiente") {
    if (!tema.fondoGradienteAnimado) {
      capaFondo = (
        <LinearGradient
          colors={[tema.fondoGradienteInicio, tema.fondoGradienteFin]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      );
    } else {
      capaFondo = (
        <>
          <LinearGradient
            colors={[tema.fondoGradienteInicio, tema.fondoGradienteFin]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GradienteAnimado
            colors={[tema.fondoGradienteFin, tema.fondoGradienteInicio]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        </>
      );
    }
  } else if (tema.fondoTipo === "imagen" && tema.fondoImagenUrl) {
    capaFondo = (
      <FondoImagenCapa
        key={tema.fondoImagenUrl}
        url={tema.fondoImagenUrl}
        colorFallback={tema.fondoColor}
        opacidadOverlay={tema.fondoOpacidadOverlay}
      />
    );
  } else if (tema.fondoTipo === "color") {
    capaFondo = (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: tema.fondoColor }]}
      />
    );
  }
  // 'transparente' -> capaFondo se queda en null (no pinta nada de fondo)

  const capaFondoEnvuelta = (
    <View
      style={[
        fijarAlViewport ? styles.capaFondoFija : styles.capaFondoConfinada,
        { pointerEvents: "none" as const },
      ]}
    >
      {capaFondo}
    </View>
  );

  return (
    <View
      style={[styles.flex, !fijarAlViewport && styles.posicionRelativa, style]}
    >
      {capaFondoEnvuelta}
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

/**
 * Capa de imagen de fondo + overlay de oscurecido, ya sin depender de
 * `flex`/altura de contenedores padres: siempre se dibuja a
 * `StyleSheet.absoluteFill` dentro de `capaFondoFija` (ver arriba), que en
 * web se monta vía portal directo en `document.body`.
 */
function FondoImagenCapa({
  url,
  colorFallback,
  opacidadOverlay,
}: {
  url: string;
  colorFallback: string;
  opacidadOverlay: number;
}) {
  const [cargando, setCargando] = useState(true);
  const [conError, setConError] = useState(false);

  if (conError) {
    console.log("[DEBUG FondoImagenCapa] error al renderizar imagen", { url });
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colorFallback }]}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Color de respaldo visible mientras carga o si algo falla */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colorFallback }]}
      />
      <Image
        source={{ uri: url }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        onLoadEnd={() => {
          setCargando(false);
          console.log("[DEBUG FondoImagenCapa] onLoadEnd", { url });
        }}
        onError={(error) => {
          setCargando(false);
          setConError(true);
          console.log("[DEBUG FondoImagenCapa] onError", { url, error });
        }}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(0,0,0,${opacidadOverlay})` },
        ]}
      />
      {cargando && (
        <View style={[StyleSheet.absoluteFill, styles.cargandoOverlay]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Ancla la capa `capaFondoConfinada` (position: absolute) a ESTE
  // contenedor en vez de a un ancestro lejano cualquiera que tenga
  // position distinto de "static".
  posicionRelativa: { position: "relative" as const },
  // Nada de portal (evita el bug de capas taparse con <body>), pero
  // TAMPOCO dependemos de que toda la cadena de padres tenga `flex`/
  // altura real (`StyleSheet.absoluteFill` normal sí depende de eso, y
  // expo-router mete sus propios <div> internos de navegación entre
  // medio donde esa cadena se puede romper sin que se note en el resto
  // de la pantalla). En web usamos `position: fixed`, que se ancla
  // directo al viewport sin importar la altura de ningún padre. Como ya
  // NO es un portal, respeta el orden normal del árbol de React para el
  // stacking (se pinta primero, por eso el contenido de encima se ve
  // bien sin necesitar z-index). En nativo no existe `position: fixed`
  // en CSS, así que ahí se queda como `absolute` normal, cubriendo a su
  // padre inmediato (este mismo componente, que sí cubre toda la
  // pantalla en nativo sin el problema de alturas de la web).
  capaFondoFija: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as ViewStyle,
  // Usada cuando fijarAlViewport=false (vistas previas confinadas, como
  // VistaPreviaTema): `position: absolute` normal, ancla a
  // `posicionRelativa` (el contenedor raíz de este mismo componente) en
  // vez de al viewport completo. Respeta el `overflow: hidden` de la
  // cajita que lo envuelve.
  capaFondoConfinada: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as ViewStyle,
  cargandoOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});
