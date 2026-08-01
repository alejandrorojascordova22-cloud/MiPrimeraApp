import React, { useEffect, useState } from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle, Animated, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { TemaConfig } from '../services/temaConfig';

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
 */
interface FondoDinamicoProps {
  tema: TemaConfig;
  children: React.ReactNode;
  style?: ViewStyle;
}

const GradienteAnimado = Animated.createAnimatedComponent(LinearGradient);

export function FondoDinamico({ tema, children, style }: FondoDinamicoProps) {
  const [progreso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (tema.fondoTipo !== 'gradiente' || !tema.fondoGradienteAnimado) return;

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
      ])
    );

    animacion.start();
    return () => animacion.stop();
  }, [tema.fondoTipo, tema.fondoGradienteAnimado, tema.fondoGradienteDuracionMs, progreso]);

  if (tema.fondoTipo === 'gradiente') {
    if (!tema.fondoGradienteAnimado) {
      return (
        <LinearGradient
          colors={[tema.fondoGradienteInicio, tema.fondoGradienteFin]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.flex, style]}
        >
          {children}
        </LinearGradient>
      );
    }

    // Animado: se cruzan dos capas de gradiente (normal / invertida) con
    // opacidad interpolada, dando efecto de movimiento sin librerías extra.
    return (
      <View style={[styles.flex, style]}>
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
        <View style={styles.flex}>{children}</View>
      </View>
    );
  }

  if (tema.fondoTipo === 'imagen' && tema.fondoImagenUrl) {
    return (
      <FondoImagen
        // key={url}: al cambiar de imagen, React desmonta y vuelve a
        // montar este componente de cero en vez de reusar el mismo, así
        // "cargando"/"conError" siempre arrancan limpios para la imagen
        // nueva sin necesitar un setState dentro de un useEffect.
        key={tema.fondoImagenUrl}
        url={tema.fondoImagenUrl}
        colorFallback={tema.fondoColor}
        opacidadOverlay={tema.fondoOpacidadOverlay}
        style={style}
      >
        {children}
      </FondoImagen>
    );
  }

  if (tema.fondoTipo === 'transparente') {
    return <View style={[styles.flex, style]}>{children}</View>;
  }

  // 'color' o fallback
  return (
    <View style={[styles.flex, { backgroundColor: tema.fondoColor }, style]}>
      {children}
    </View>
  );
}

/**
 * Fondo tipo "imagen", separado en su propio componente porque necesitaba
 * arreglar dos bugs reales que hacían que "no se viera bien" al aplicarse:
 *
 * 1) EN WEB, `<ImageBackground>` de React Native se apoya en que TODA la
 *    cadena de contenedores padres tenga altura 100% definida. Si algún
 *    padre (el `<html>`/`<body>`/root div de Expo Web) no tiene
 *    height: 100% explícito, `flex: 1` colapsa a 0px de alto y la imagen
 *    de fondo no se pinta (aunque en nativo sí funcione). Por eso aquí se
 *    fuerza `minHeight: '100%'` en web además de `flex: 1`.
 * 2) No había ningún manejo de error ni de "cargando": si la URL de la
 *    imagen fallaba (permisos del bucket, URL mal pegada, imagen borrada)
 *    el fondo simplemente se quedaba en blanco sin avisar nada, y parecía
 *    que "no aplicaba". Ahora, mientras carga se ve un indicador breve, y
 *    si falla se usa el color de fondo configurado como respaldo en vez
 *    de dejar la pantalla en blanco.
 */
function FondoImagen({
  url,
  colorFallback,
  opacidadOverlay,
  style,
  children,
}: {
  url: string;
  colorFallback: string;
  opacidadOverlay: number;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const [cargando, setCargando] = useState(true);
  const [conError, setConError] = useState(false);

  if (conError) {
    return (
      <View style={[styles.flex, styles.webAltura, { backgroundColor: colorFallback }, style]}>
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: url }}
      resizeMode="cover"
      style={[styles.flex, styles.webAltura, style]}
      imageStyle={styles.webAltura}
      onLoadEnd={() => setCargando(false)}
      onError={() => {
        setCargando(false);
        setConError(true);
      }}
    >
      <View
        style={[
          styles.overlay,
          { backgroundColor: `rgba(0,0,0,${opacidadOverlay})` },
        ]}
      >
        {children}
      </View>
      {cargando && (
        <View
          style={[StyleSheet.absoluteFill, styles.cargandoOverlay]}
          pointerEvents="none"
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1 },
  // Solo en web: sin esto la imagen de fondo puede quedarse en 0px de
  // alto y "no aplicarse" aunque la URL sea correcta (ver FondoImagen).
  webAltura: Platform.OS === 'web' ? { minHeight: '100%' as any } : {},
  cargandoOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});