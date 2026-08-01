import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  GestureResponderEvent,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ColoresApp } from "@/constants/coloresApp";

/**
 * Selector de color VISUAL para reemplazar los campos "escribe el código
 * hex" en Apariencia del Sistema. En vez de pedirle a Alejandro (o al
 * admin) que sepa el código de un color, aquí se elige tocando:
 *
 *  1) Una paleta de colores comunes (chips).
 *  2) Una barra de tono (arcoíris) para moverse a cualquier color.
 *  3) Una tira de variantes claro→oscuro de ese tono.
 *
 * El código hex sigue existiendo por debajo (es lo que se guarda en
 * Supabase, tal cual antes), pero ahora es el resultado de tocar, no algo
 * que haya que escribir. Se deja un campito de hex chico y opcional por si
 * alguien sí quiere pegar un código exacto (p.ej. el de la marca).
 */

interface ColorPickerCampoProps {
  etiqueta: string;
  valor: string; // hex '#RRGGBB'
  onChangeText: (hex: string) => void;
  ayuda?: string; // texto pequeño de contexto bajo la etiqueta
}

const PALETA_RAPIDA = [
  "#0055A4", "#8B5CF6", "#2563EB", "#0EA5E9", "#10B981", "#22C55E",
  "#EAB308", "#F97316", "#EF4444", "#EC4899", "#A855F7", "#64748B",
  "#1F2A44", "#0B0821", "#FFFFFF", "#F2F5FA", "#111827", "#6DFE9C",
];

const TONOS_ARCOIRIS = [
  "#FF0000", "#FF8800", "#FFEE00", "#B3FF00", "#22FF00", "#00FFAA",
  "#00FFFF", "#0088FF", "#0000FF", "#8800FF", "#FF00EE", "#FF0000",
];

function normalizarHex(v: string): string {
  let s = (v || "").trim();
  if (!s.startsWith("#")) s = `#${s}`;
  return s.toUpperCase();
}

function hexValido(v: string): boolean {
  return /^#([0-9A-Fa-f]{6})$/.test(v);
}

function hexARgb(hex: string): { r: number; g: number; b: number } {
  const limpio = hex.replace("#", "");
  const bigint = parseInt(limpio, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbAHex(r: number, g: number, b: number): string {
  const a = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${a(r)}${a(g)}${a(b)}`.toUpperCase();
}

function hslAHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s));
  l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbAHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function hexAHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexARgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function ColorPickerCampo({
  etiqueta,
  valor,
  onChangeText,
  ayuda,
}: ColorPickerCampoProps) {
  const [abierto, setAbierto] = useState(false);
  const [hexManual, setHexManual] = useState(valor);
  const anchoTonoRef = useRef(1);

  const hexActual = hexValido(normalizarHex(valor))
    ? normalizarHex(valor)
    : "#0055A4";
  const { h, l } = hexAHsl(hexActual);

  const aplicar = (hex: string) => {
    setHexManual(hex);
    onChangeText(hex);
  };

  const moverTono = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const ancho = anchoTonoRef.current || 1;
    const proporcion = Math.min(1, Math.max(0, x / ancho));
    const nuevoTono = proporcion * 360;
    aplicar(hslAHex(nuevoTono, 0.75, Math.min(0.85, Math.max(0.15, l))));
  };

  // Tira de variantes claro→oscuro del tono actual.
  const variantes = [0.9, 0.75, 0.6, 0.5, 0.4, 0.28, 0.16];

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}

      <Pressable
        style={styles.filaSelector}
        onPress={() => setAbierto((a) => !a)}
      >
        <View style={[styles.muestraGrande, { backgroundColor: hexActual }]} />
        <Text style={styles.hexTexto}>{hexActual}</Text>
        <Ionicons
          name={abierto ? "chevron-up" : "chevron-down"}
          size={18}
          color={ColoresApp.textoSecundario}
        />
      </Pressable>

      {abierto && (
        <View style={styles.panel}>
          <Text style={styles.subEtiqueta}>COLORES RÁPIDOS</Text>
          <View style={styles.gridPaleta}>
            {PALETA_RAPIDA.map((c) => {
              const seleccionado = c.toUpperCase() === hexActual;
              return (
                <Pressable
                  key={c}
                  onPress={() => aplicar(c)}
                  style={[
                    styles.chipColor,
                    {
                      backgroundColor: c,
                      borderColor: seleccionado
                        ? ColoresApp.primario
                        : "rgba(0,0,0,0.08)",
                      borderWidth: seleccionado ? 3 : 1,
                    },
                  ]}
                >
                  {seleccionado && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={
                        hexAHsl(c).l > 0.6 ? "#111827" : "#FFFFFF"
                      }
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.subEtiqueta}>TONO</Text>
          <View
            onLayout={(e) => {
              anchoTonoRef.current = e.nativeEvent.layout.width;
            }}
            style={styles.zonaTono}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={moverTono}
            onResponderMove={moverTono}
          >
            <LinearGradient
              colors={TONOS_ARCOIRIS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.barraTono}
            />
            <View
              style={[
                styles.perillaTono,
                { left: `${(h / 360) * 100}%` },
              ]}
            />
          </View>

          <Text style={styles.subEtiqueta}>CLARO / OSCURO</Text>
          <View style={styles.filaVariantes}>
            {variantes.map((lv) => {
              const c = hslAHex(h, 0.75, lv);
              const seleccionado = c.toUpperCase() === hexActual;
              return (
                <Pressable
                  key={lv}
                  onPress={() => aplicar(c)}
                  style={[
                    styles.variante,
                    {
                      backgroundColor: c,
                      borderColor: seleccionado
                        ? ColoresApp.primario
                        : "rgba(0,0,0,0.08)",
                      borderWidth: seleccionado ? 3 : 1,
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.filaHexManual}>
            <Text style={styles.hexManualEtiqueta}>Código exacto:</Text>
            <TextInput
              value={hexManual}
              onChangeText={setHexManual}
              onBlur={() => {
                const normal = normalizarHex(hexManual);
                if (hexValido(normal)) aplicar(normal);
                else setHexManual(hexActual);
              }}
              autoCapitalize="none"
              placeholder="#0055A4"
              placeholderTextColor="#8A94A6"
              style={styles.hexManualInput}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: 16 },
  etiqueta: {
    fontSize: 14,
    fontWeight: "600",
    color: ColoresApp.texto,
    marginBottom: 2,
  },
  ayuda: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginBottom: 6,
  },
  filaSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  muestraGrande: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  hexTexto: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ColoresApp.texto,
  },
  panel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    backgroundColor: "#FAFBFD",
  },
  subEtiqueta: {
    fontSize: 11,
    fontWeight: "700",
    color: ColoresApp.textoSecundario,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  gridPaleta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  chipColor: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  zonaTono: {
    height: 28,
    justifyContent: "center",
    marginBottom: 4,
  },
  barraTono: {
    height: 14,
    borderRadius: 7,
  },
  perillaTono: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "white",
    backgroundColor: "#00000022",
    top: -3,
    transform: [{ translateX: -10 }],
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  filaVariantes: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  variante: {
    flex: 1,
    height: 30,
    borderRadius: 8,
  },
  filaHexManual: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  hexManualEtiqueta: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
  },
  hexManualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: ColoresApp.texto,
    backgroundColor: "#FFFFFF",
  },
});