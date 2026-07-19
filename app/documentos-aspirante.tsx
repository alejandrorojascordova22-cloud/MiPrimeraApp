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

const ItemMaterial = ({ material }: { material: Record<string, any> }) => {
  const tipo: string = material.tipo ?? "otro";
  const url: string = material.url_publica;
  const [previewError, setPreviewError] = useState(false);

  return (
    <View style={styles.materialItem}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={styles.iconoContainer}>
          <Ionicons
            name={ICONO_POR_TIPO_MATERIAL[tipo] ?? "attach-outline"}
            color={ColoresApp.primario}
            size={16}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.materialTitulo} numberOfLines={1}>
            {material.titulo}
          </Text>
          {!!material.descripcion && (
            <Text style={styles.materialDescripcion} numberOfLines={2}>
              {material.descripcion}
            </Text>
          )}
        </View>
        <Pressable
          style={styles.botonVerMaterial}
          onPress={() => Linking.openURL(url)}
        >
          <Ionicons name="open-outline" size={14} color="white" />
        </Pressable>
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
        <Pressable onPress={() => router.back()} hitSlop={10}>
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
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.iconoContainer}>
                <Ionicons
                  name="book-outline"
                  color={ColoresApp.primario}
                  size={20}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.tituloGuia}>Guía de estudio 2026</Text>
                <Text style={styles.subtituloGuia}>
                  {urlGuia
                    ? "Material oficial para prepararte"
                    : "Aún no hay guía disponible"}
                </Text>
              </View>
            </View>
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
            <Text style={styles.emptyText}>
              Aún no hay materiales disponibles.
            </Text>
          ) : (
            <View style={styles.card}>
              {materiales.map((m, i) => (
                <View key={m.id ?? i}>
                  <ItemMaterial material={m} />
                  {i < materiales.length - 1 && <View style={{ height: 10 }} />}
                </View>
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
    fontSize: 13,
    fontWeight: "700",
    color: ColoresApp.oscuro,
    marginTop: 8,
    marginBottom: 10,
  },
  emptyText: {
    textAlign: "center",
    color: ColoresApp.textoSecundario,
    marginTop: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 16,
  },
  iconoContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1EBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  tituloGuia: { fontWeight: "bold", fontSize: 13, color: ColoresApp.oscuro },
  subtituloGuia: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  botonGuia: {
    marginTop: 12,
    backgroundColor: ColoresApp.primario,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  textoBotonGuia: { color: "white", fontWeight: "600", fontSize: 13 },
  materialItem: {},
  materialTitulo: {
    fontWeight: "bold",
    fontSize: 12.5,
    color: ColoresApp.oscuro,
  },
  materialDescripcion: { fontSize: 11, color: ColoresApp.textoSecundario },
  botonVerMaterial: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: ColoresApp.primario,
    alignItems: "center",
    justifyContent: "center",
  },
  materialImagenPreview: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginTop: 8,
  },
});
