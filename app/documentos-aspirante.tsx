import { ColoresApp } from "@/constants/coloresApp";
import {
  obtenerMaterialesEstudio,
  obtenerUrlGuiaEstudio,
} from "@/services/materialesEstudioServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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

          <Pressable
            style={styles.botonVerMaterial}
            onPress={() => Linking.openURL(url)}
          >
            <Text style={styles.textoBotonVerMaterial}>Abrir</Text>
            <Ionicons name="open-outline" size={13} color={ColoresApp.primario} />
          </Pressable>
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
    </View>
  );
};

export default function DocumentosAspiranteScreen() {
  const router = useRouter();
  const [materiales, setMateriales] = useState<Record<string, any>[]>([]);
  const [urlGuia, setUrlGuia] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [listaMateriales, guia] = await Promise.all([
        obtenerMaterialesEstudio(),
        obtenerUrlGuiaEstudio(),
      ]);
      setMateriales(listaMateriales);
      setUrlGuia(guia);
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
          <Text style={styles.seccionLabel}>Guía oficial</Text>
          <View style={styles.guiaCard}>
            <View style={styles.guiaFilaSuperior}>
              <View style={styles.guiaIconoContainer}>
                <Ionicons name="book-outline" color="white" size={22} />
              </View>
              <View
                style={[
                  styles.chipEstado,
                  urlGuia ? styles.chipEstadoOk : styles.chipEstadoPendiente,
                ]}
              >
                <Ionicons
                  name={urlGuia ? "checkmark-circle" : "time-outline"}
                  size={12}
                  color={urlGuia ? ColoresApp.exito : ColoresApp.advertencia}
                />
                <Text
                  style={[
                    styles.chipEstadoTexto,
                    { color: urlGuia ? ColoresApp.exito : ColoresApp.advertencia },
                  ]}
                >
                  {urlGuia ? "Disponible" : "Próximamente"}
                </Text>
              </View>
            </View>

            <Text style={styles.tituloGuia}>Guía de estudio 2026</Text>
            <Text style={styles.subtituloGuia}>
              {urlGuia
                ? "Material oficial para prepararte para el examen de admisión."
                : "Aún no hay una guía publicada. En cuanto esté lista aparecerá aquí."}
            </Text>

            {!!urlGuia && (
              <Pressable
                style={styles.botonGuia}
                onPress={() => Linking.openURL(urlGuia)}
              >
                <Ionicons name="download-outline" size={15} color="white" />
                <Text style={styles.textoBotonGuia}>Descargar PDF</Text>
              </Pressable>
            )}
          </View>

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

  // --- Guía de estudio ---
  guiaCard: {
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 18,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  guiaFilaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  guiaIconoContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: ColoresApp.primario,
    alignItems: "center",
    justifyContent: "center",
  },
  chipEstado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipEstadoOk: { backgroundColor: ColoresApp.exitoFondo },
  chipEstadoPendiente: { backgroundColor: "#FDF3E1" },
  chipEstadoTexto: { fontSize: 11, fontWeight: "700" },
  tituloGuia: {
    fontWeight: "800",
    fontSize: 16,
    color: ColoresApp.oscuro,
  },
  subtituloGuia: {
    fontSize: 12.5,
    color: ColoresApp.textoSecundario,
    marginTop: 4,
    lineHeight: 18,
  },
  botonGuia: {
    marginTop: 14,
    backgroundColor: ColoresApp.primario,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  textoBotonGuia: { color: "white", fontWeight: "700", fontSize: 13.5 },

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
  textoBotonVerMaterial: {
    color: ColoresApp.primario,
    fontWeight: "700",
    fontSize: 12,
  },
  materialImagenPreview: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    marginTop: 10,
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