import React, { useEffect, useRef } from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle, Animated } from 'react-native';
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
  const progreso = useRef(new Animated.Value(0)).current;

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
      <ImageBackground
        source={{ uri: tema.fondoImagenUrl }}
        resizeMode="cover"
        style={[styles.flex, style]}
      >
        <View
          style={[
            styles.overlay,
            { backgroundColor: `rgba(0,0,0,${tema.fondoOpacidadOverlay})` },
          ]}
        >
          {children}
        </View>
      </ImageBackground>
    );
  }

  // 'color' o fallback
  return (
    <View style={[styles.flex, { backgroundColor: tema.fondoColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1 },
});