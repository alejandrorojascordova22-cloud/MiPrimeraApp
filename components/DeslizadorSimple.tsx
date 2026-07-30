import React, { useRef, useState } from "react";
import { View, StyleSheet, GestureResponderEvent } from "react-native";

/**
 * Deslizador (slider) mínimo hecho con las APIs core de React Native, sin
 * dependencias nativas nuevas (por eso no usamos @react-native-community/
 * slider: agregar un paquete nativo nuevo es justo lo que rompió el EAS
 * Build la vez pasada). Funciona igual en web, iOS y Android porque solo
 * usa eventos de toque estándar (onStartShouldSetResponder /
 * onResponderMove), que React Native Web también soporta.
 */
interface DeslizadorSimpleProps {
  valor: number; // 0..1
  onCambiar: (v: number) => void;
  color?: string;
  colorPista?: string;
}

export function DeslizadorSimple({
  valor,
  onCambiar,
  color = "#0055A4",
  colorPista = "#E2E8F0",
}: DeslizadorSimpleProps) {
  const anchoRef = useRef(1);
  const [arrastrando, setArrastrando] = useState(false);
  const v = Math.min(1, Math.max(0, valor));

  const calcularDesdeToque = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const ancho = anchoRef.current || 1;
    const nuevo = Math.min(1, Math.max(0, x / ancho));
    onCambiar(Math.round(nuevo * 100) / 100);
  };

  return (
    <View
      onLayout={(e) => {
        anchoRef.current = e.nativeEvent.layout.width;
      }}
      style={styles.zonaToque}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        setArrastrando(true);
        calcularDesdeToque(e);
      }}
      onResponderMove={calcularDesdeToque}
      onResponderRelease={() => setArrastrando(false)}
    >
      <View style={[styles.pista, { backgroundColor: colorPista }]}>
        <View
          style={[
            styles.progreso,
            { width: `${v * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View
        style={[
          styles.perilla,
          {
            left: `${v * 100}%`,
            backgroundColor: color,
            transform: [
              { translateX: -10 },
              { scale: arrastrando ? 1.15 : 1 },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  zonaToque: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  pista: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progreso: {
    height: "100%",
    borderRadius: 3,
  },
  perilla: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "white",
    top: 6,
  },
});
