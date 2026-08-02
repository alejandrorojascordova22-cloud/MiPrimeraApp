import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FondoDinamico } from "@/components/FondoDinamico";
import type { TemaConfig } from "@/services/temaConfig";

/**
 * Vista previa "de verdad" del tema que se está editando en Apariencia
 * del Sistema. Antes, el preview era una cajita que solo pintaba
 * `fondoColor` a mano — si el admin elegía "Degradado", "Imagen" o
 * "Transparente" el preview se quedaba igual y no reflejaba nada, por
 * eso no coincidía con lo que se veía luego en la app real.
 *
 * Ahora este componente usa el MISMO <FondoDinamico> que envuelve toda
 * la app (app/_layout.tsx), con el borrador de tema en edición. Así
 * degradado animado, imagen con overlay, transparente y color sólido se
 * ven exactamente como se verán al guardar.
 */
interface VistaPreviaTemaProps {
  tema: TemaConfig;
}

export function VistaPreviaTema({ tema }: VistaPreviaTemaProps) {
  const esTarjetaGlass = tema.estiloTarjeta === "glass";
  const esTarjetaSombra = tema.estiloTarjeta === "sombra";

  return (
    <View style={styles.marco}>
      <FondoDinamico tema={tema} style={styles.lienzo} fijarAlViewport={false}>
        <View style={styles.contenido}>
          {/* Simula una barra superior de la app */}
          <View style={styles.barraSuperior}>
            <View
              style={[
                styles.puntoBarra,
                { backgroundColor: tema.colorPrimario },
              ]}
            />
            <Text
              style={[styles.textoBarra, { color: tema.colorTexto }]}
              numberOfLines={1}
            >
              Vista previa en vivo
            </Text>
          </View>

          {/* Simula una tarjeta como las que usa la app */}
          <View
            style={[
              styles.tarjeta,
              {
                borderRadius: tema.radioBordes,
                backgroundColor: esTarjetaGlass
                  ? "rgba(255,255,255,0.18)"
                  : "#FFFFFF",
                borderWidth: esTarjetaGlass ? 1 : 0,
                borderColor: "rgba(255,255,255,0.35)",
              },
              esTarjetaSombra && styles.tarjetaSombra,
            ]}
          >
            <Text
              style={[
                styles.tituloTarjeta,
                { color: esTarjetaGlass ? tema.colorTexto : "#1F2A44" },
              ]}
            >
              Así se verá una tarjeta
            </Text>
            <Text
              style={[
                styles.subtituloTarjeta,
                {
                  color: esTarjetaGlass
                    ? "rgba(255,255,255,0.75)"
                    : "#64748B",
                },
              ]}
            >
              Texto secundario de ejemplo
            </Text>
            <View style={styles.filaBotones}>
              <View
                style={[
                  styles.botonPrimario,
                  {
                    backgroundColor: tema.colorPrimario,
                    borderRadius: Math.min(tema.radioBordes, 20),
                  },
                ]}
              >
                <Text style={styles.textoBotonPrimario}>Botón</Text>
              </View>
              <View
                style={[
                  styles.acentoSecundario,
                  { backgroundColor: tema.colorSecundario },
                ]}
              />
            </View>
          </View>
        </View>
      </FondoDinamico>
    </View>
  );
}

const styles = StyleSheet.create({
  marco: {
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 16,
  },
  lienzo: { flex: 1 },
  contenido: { flex: 1, padding: 16, justifyContent: "space-between" },
  barraSuperior: { flexDirection: "row", alignItems: "center", gap: 8 },
  puntoBarra: { width: 10, height: 10, borderRadius: 5 },
  textoBarra: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  tarjeta: { padding: 14 },
  tarjetaSombra: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tituloTarjeta: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  subtituloTarjeta: { fontSize: 12, marginBottom: 12 },
  filaBotones: { flexDirection: "row", alignItems: "center", gap: 10 },
  botonPrimario: { paddingVertical: 8, paddingHorizontal: 16 },
  textoBotonPrimario: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  acentoSecundario: { width: 18, height: 18, borderRadius: 9 },
});