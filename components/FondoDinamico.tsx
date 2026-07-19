import React from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { TemaConfig } from '../services/temaConfig';

/**
 * Envuelve una pantalla completa y pinta el fondo configurado en
 * Ajustes del Sistema (color sólido, degradado o imagen con overlay).
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

export function FondoDinamico({ tema, children, style }: FondoDinamicoProps) {
  if (tema.fondoTipo === 'gradiente') {
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
