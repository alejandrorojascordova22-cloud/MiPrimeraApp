import { ColoresApp } from "@/constants/coloresApp";
import { obtenerMaterialesEstudio } from "@/services/materialesEstudioServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { createElement, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Pantalla "Documentos" del aspirante.
 *
 * Antes esto vivía como la tarjeta "Materiales de estudio" dentro de
 * perfil-aspirante.tsx. Se movió a su propia pantalla (accesible desde el
 * ítem "Documentos" del menú lateral) para dejar la pantalla principal más
 * limpia; en su lugar, ahí ahora se muestra el manual de usuario.
 *
 * Nota: ya no hay una tarjeta separada de "Guía de estudio", porque la guía
 * es, en la práctica, un material de estudio más (tipo PDF) subido por el
 * admin desde "Gestionar materiales". Mostrarla aparte duplicaba la misma
 * información. Ahora todo vive junto en la lista de "Materiales de estudio",
 * y cada material se puede visualizar directamente en pantalla (PDF, imagen,
 * audio o video) sin salir de la app, además de poder abrirlo en una pestaña
 * nueva si el aspirante lo prefiere.
 */

const ICONO_POR_TIPO_MATERIAL: Record<string, keyof typeof Ionicons.glyphMap> =
  {
    pdf: "document-text-outline",
    audio: "musical-notes-outline",
    imagen: "image-outline",
    video: "videocam-outline",
    otro: "attach-outline",
  };

const ETIQUETA_POR_TIPO: Record<string, string> = {
  pdf: "PDF",
  audio: "Audio",
  imagen: "Imagen",
  video: "Video",
  otro: "Archivo",
};

const ItemMaterial = ({ material }: { material: Record<string, any> }) => {
  const tipo: string = material.tipo ?? "otro";
  const url: string = material.url_publica;
  const [previewError, setPreviewError] = useState(false);
  const [verEnPantalla, setVerEnPantalla] = useState(false);

  const puedeVerEnPantalla = Platform.OS === "web";

  return (
    <View style={styles.materialCard}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={styles.iconoContainer}>
          <Ionicons
            name={ICONO_POR_TIPO_MATERIAL[tipo] ?? "attach-outline"}
            color={ColoresApp.primario}
            size={18}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.materialCabecera}>
            <Text style={styles.materialTitulo} numberOfLines={1}>
              {material.titulo}
            </Text>
            <View style={styles.chipTipo}>
              <Text style={styles.chipTipoTexto}>
                {ETIQUETA_POR_TIPO[tipo] ?? "Archivo"}
              </Text>
            </View>
          </View>
          {!!material.descripcion && (
            <Text style={styles.materialDescripcion} numberOfLines={2}>
              {material.descripcion}
            </Text>
          )}

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {puedeVerEnPantalla && (
              <Pressable
                style={[
                  styles.botonVerMaterial,
                  verEnPantalla && styles.botonVerMaterialActivo,
                ]}
                onPress={() => setVerEnPantalla((v) => !v)}
              >
                <Text
                  style={[
                    styles.textoBotonVerMaterial,
                    verEnPantalla && styles.textoBotonVerMaterialActivo,
                  ]}
                >
                  {verEnPantalla ? "Ocultar" : "Ver aquí"}
                </Text>
                <Ionicons
                  name={verEnPantalla ? "eye-off-outline" : "eye-outline"}
                  size={13}
                  color={
                    verEnPantalla ? "white" : ColoresApp.primario
                  }
                />
              </Pressable>
            )}
            <Pressable
              style={styles.botonVerMaterial}
              onPress={() => Linking.openURL(url)}
            >
              <Text style={styles.textoBotonVerMaterial}>
                {puedeVerEnPantalla ? "Abrir en pestaña nueva" : "Abrir"}
              </Text>
              <Ionicons
                name="open-outline"
                size={13}
                color={ColoresApp.primario}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {tipo === "imagen" && !previewError && (
        <Image
          source={{ uri: url }}
          style={styles.materialImagenPreview}
          resizeMode="cover"
          onError={() => setPreviewError(true)}
        />
      )}

      {verEnPantalla && puedeVerEnPantalla && (
        <View style={styles.visorContainer}>
          {tipo === "pdf" &&
            createElement("iframe", {
              src: url,
              style: { width: "100%", height: "100%", border: "none" },
              title: material.titulo,
            })}
          {tipo === "video" &&
            createElement("video", {
              src: url,
              controls: true,
              style: { width: "100%", height: "100%", backgroundColor: "black" },
            })}
          {tipo === "audio" &&
            createElement("audio", {
              src: url,
              controls: true,
              style: { width: "100%", marginTop: 8 },
            })}
          {tipo === "imagen" &&
            createElement("img", {
              src: url,
              style: { width: "100%", height: "100%", objectFit: "contain" },
            })}
          {tipo === "otro" && (
            <View style={styles.visorNoDisponible}>
              <Ionicons
                name="document-outline"
                size={22}
                color={ColoresApp.textoSecundario}
              />
              <Text style={styles.visorNoDisponibleTexto}>
                Este tipo de archivo no se puede previsualizar aquí. Usa
                &quot;Abrir en pestaña nueva&quot;.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function DocumentosAspiranteScreen() {
  const router = useRouter();
  const [materiales, setMateriales] = useState<Record<string, any>[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const listaMateriales = await obtenerMaterialesEstudio();
      setMateriales(listaMateriales);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      cargar();
    }, 0);

    return () => clearTimeout(id);
  }, [cargar]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/perfil-aspirante')
          }
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Documentos</Text>
        <View style={{ width: 22 }} />
      </View>

      {cargando ? (
        <ActivityIndicator
          style={{ marginTop: 60 }}
          size="large"
          color={ColoresApp.primario}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={cargando} onRefresh={cargar} />
          }
        >
          <Text style={styles.seccionLabel}>Materiales de estudio</Text>
          {materiales.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="folder-open-outline"
                size={28}
                color={ColoresApp.textoSecundario}
              />
              <Text style={styles.emptyText}>
                Aún no hay materiales disponibles.
              </Text>
              <Text style={styles.emptySubtext}>
                Cuando se publiquen, los verás listados aquí.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {materiales.map((m, i) => (
                <ItemMaterial key={m.id ?? i} material={m} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ColoresApp.fondo },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  topBarTitulo: { fontSize: 16, fontWeight: "700", color: ColoresApp.oscuro },
  scrollContent: { padding: 16, paddingBottom: 40 },
  seccionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: ColoresApp.textoSecundario,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 10,
  },

  // --- Materiales ---
  materialCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconoContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1EBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  materialCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  materialTitulo: {
    fontWeight: "700",
    fontSize: 14,
    color: ColoresApp.oscuro,
    flexShrink: 1,
  },
  materialDescripcion: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 3,
    lineHeight: 17,
  },
  chipTipo: {
    backgroundColor: ColoresApp.primarioFondo,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipTipoTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: ColoresApp.primario,
  },
  botonVerMaterial: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: ColoresApp.primarioFondo,
  },
  botonVerMaterialActivo: {
    backgroundColor: ColoresApp.primario,
  },
  textoBotonVerMaterial: {
    color: ColoresApp.primario,
    fontWeight: "700",
    fontSize: 12,
  },
  textoBotonVerMaterialActivo: {
    color: "white",
  },
  materialImagenPreview: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    marginTop: 10,
  },
  visorContainer: {
    marginTop: 12,
    height: 480,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    backgroundColor: "#F4F4F6",
  },
  visorNoDisponible: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  visorNoDisponibleTexto: {
    textAlign: "center",
    fontSize: 12.5,
    color: ColoresApp.textoSecundario,
  },

  // --- Estado vacío ---
  emptyState: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderStyle: "dashed",
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    color: ColoresApp.oscuro,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 10,
  },
  emptySubtext: {
    textAlign: "center",
    color: ColoresApp.textoSecundario,
    fontSize: 11.5,
    marginTop: 4,
  },
});