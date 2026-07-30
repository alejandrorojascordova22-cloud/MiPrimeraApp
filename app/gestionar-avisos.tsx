import BannerPermisoNotificaciones from "@/components/BannerPermisoNotificaciones";
import { avisar } from "@/components/ConfirmDialog";
import { ColoresApp } from "@/constants/coloresApp";
import {
  obtenerAspirantes,
  obtenerAspirantesPorCarrera,
} from "@/services/aspirantesServicio";
import {
  desactivarAviso,
  obtenerTodosLosAvisos,
  publicarAviso,
  type Aviso,
} from "@/services/avisosServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import { enviarPushNotificacion } from "@/services/pushNotificacionesServicio";
import { supabase } from "@/services/supabaseClient";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Carrera = { id: number; nombre: string };

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const AvisoRow = ({
  aviso,
  onDesactivar,
}: {
  aviso: Aviso & { carreras?: { nombre?: string } };
  onDesactivar: () => void;
}) => (
  <View style={[styles.card, !aviso.activo && styles.cardInactivo]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.cardTitulo}>{aviso.titulo}</Text>
      <Text style={styles.cardContenido} numberOfLines={2}>
        {aviso.contenido}
      </Text>
      <Text style={styles.cardMeta}>
        {aviso.carrera_id
          ? (aviso.carreras?.nombre ?? "Carrera específica")
          : "Todas las carreras"}{" "}
        · {formatDate(aviso.creado_en)}
        {!aviso.activo ? " · inactivo" : ""}
      </Text>
    </View>
    {aviso.activo && (
      <Pressable onPress={onDesactivar} hitSlop={8}>
        <Ionicons name="trash-outline" size={20} color="red" />
      </Pressable>
    )}
  </View>
);

const PublicarAvisoModal = ({
  visible,
  onClose,
  onGuardado,
  carreras,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado: () => void;
  carreras: Carrera[];
}) => {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [carreraId, setCarreraId] = useState<number | null>(null);
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (visible) {
        setTitulo("");
        setContenido("");
        setCarreraId(null);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [visible, carreras]);

  const handlePublicar = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      avisar("Falta información", "Escribe título y contenido del aviso.");
      return;
    }
    setPublicando(true);
    try {
      const { aviso, ok } = await publicarAviso({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        carreraId,
      });

      if (!ok) {
        // Solo esto es un fallo real (Supabase tiró un error en el insert).
        avisar("Error", "No se pudo publicar el aviso.");
        return;
      }

      // El insert sí funcionó. `aviso` puede venir null si RLS no deja
      // leer la fila recién creada, pero eso no significa que falló:
      // por eso SIEMPRE refrescamos la lista aquí, en vez de solo
      // hacerlo cuando `aviso` no es null (ese era el bug: la pantalla
      // se quedaba sin actualizar y parecía que había que refrescar a mano).
      onGuardado();
      onClose();

      // Además de quedar en el tablón, se manda como push a los
      // aspirantes destinatarios (todos, o solo los de esa carrera).
      // Esto no bloquea la publicación: si el push falla u omite por
      // límite, el aviso ya quedó publicado de todas formas.
      (async () => {
        try {
          const destinatarios = carreraId
            ? await obtenerAspirantesPorCarrera(carreraId)
            : await obtenerAspirantes();
          const aspiranteIds = destinatarios
            .map((a: any) => a.id)
            .filter(Boolean);
          if (aspiranteIds.length > 0) {
            // Push nativo (Expo) para celulares con build compilado.
            await enviarPushNotificacion({
              aspiranteIds,
              titulo: titulo.trim(),
              cuerpo: contenido.trim(),
              datos: { tipo: "aviso", avisoId: aviso?.id },
            });
            // Web Push real para navegador, llega aunque esté cerrado.
            try {
              await supabase.functions.invoke("enviar-push-web", {
                body: {
                  aspiranteIds,
                  titulo: titulo.trim(),
                  cuerpo: contenido.trim(),
                  datos: { tipo: "aviso", avisoId: aviso?.id },
                },
              });
            } catch (e) {
              console.warn("Error al enviar web push del aviso:", e);
            }
          }
        } catch (e) {
          console.warn("Error al enviar push del aviso:", e);
        }
      })();
    } finally {
      setPublicando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitulo}>Publicar aviso</Text>
          <TextInput
            style={styles.input}
            placeholder="Título"
            value={titulo}
            onChangeText={setTitulo}
          />
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
            placeholder="Contenido del aviso"
            value={contenido}
            onChangeText={setContenido}
            multiline
          />
          <Text style={styles.fieldLabel}>Dirigido a:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pressable
              style={[styles.chip, carreraId === null && styles.chipActivo]}
              onPress={() => setCarreraId(null)}
            >
              <Text
                style={
                  carreraId === null ? styles.chipTextoActivo : styles.chipTexto
                }
              >
                Todas las carreras
              </Text>
            </Pressable>
            {carreras.map((c) => (
              <Pressable
                key={c.id}
                style={[styles.chip, carreraId === c.id && styles.chipActivo]}
                onPress={() => setCarreraId(c.id)}
              >
                <Text
                  style={
                    carreraId === c.id
                      ? styles.chipTextoActivo
                      : styles.chipTexto
                  }
                >
                  {c.nombre}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={handlePublicar}
              disabled={publicando}
            >
              {publicando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Publicar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function GestionarAvisosScreen() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [listaAvisos, listaCarreras] = await Promise.all([
        obtenerTodosLosAvisos(),
        obtenerCarreras(),
      ]);
      setAvisos(listaAvisos);
      setCarreras(listaCarreras as Carrera[]);
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

  // Autorefresco en vivo: si el aviso se publicó desde otra pestaña, otro
  // admin, o el insert no devolvió la fila por RLS, esto igual actualiza
  // la lista solo, sin que tengas que recargar la página a mano.
  useEffect(() => {
    const canal = supabase
      .channel("gestionar-avisos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "avisos" },
        () => cargar(),
      )
      .subscribe((status) => {
        console.log("Realtime avisos (gestionar-avisos):", status);
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargar]);

  const handleDesactivar = (aviso: Aviso) => {
    const ejecutar = async () => {
      const ok = await desactivarAviso(aviso.id);
      if (ok) cargar();
      else avisar("Error", "No se pudo desactivar el aviso.");
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`¿Desactivar el aviso "${aviso.titulo}"?`)) ejecutar();
      return;
    }
    Alert.alert("¿Desactivar aviso?", aviso.titulo, [
      { text: "Cancelar", style: "cancel" },
      { text: "Desactivar", style: "destructive", onPress: ejecutar },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Text style={styles.topBarTitulo}>Avisos para aspirantes</Text>
      </View>

      <BannerPermisoNotificaciones />

      {cargando && avisos.length === 0 ? (
        <ActivityIndicator
          style={{ marginTop: 60 }}
          size="large"
          color={ColoresApp.primario}
        />
      ) : avisos.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay avisos publicados.</Text>
      ) : (
        <FlatList
          data={avisos}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <AvisoRow
              aviso={item as any}
              onDesactivar={() => handleDesactivar(item)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={cargando} onRefresh={cargar} />
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={22} color="white" />
        <Text style={styles.fabText}>Publicar aviso</Text>
      </Pressable>

      <PublicarAvisoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onGuardado={cargar}
        carreras={carreras}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ColoresApp.fondo },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  topBarTitulo: { fontSize: 15, fontWeight: "600", color: ColoresApp.oscuro },
  emptyText: {
    marginTop: 100,
    textAlign: "center",
    color: ColoresApp.textoSecundario,
  },
  listContainer: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardInactivo: { opacity: 0.5 },
  cardTitulo: { fontSize: 14, fontWeight: "700", color: ColoresApp.oscuro },
  cardContenido: { fontSize: 13, color: ColoresApp.texto, marginTop: 4 },
  cardMeta: { fontSize: 11, color: ColoresApp.textoSecundario, marginTop: 6 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: ColoresApp.primario,
    borderRadius: 99,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 6px #0000004D",
  },
  fabText: { color: "white", fontWeight: "bold", fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    gap: 12,
  },
  modalTitulo: { fontSize: 16, fontWeight: "700", color: ColoresApp.oscuro },
  input: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 9,
    padding: 12,
    fontSize: 14,
    color: ColoresApp.texto,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    backgroundColor: "white",
  },
  chipActivo: {
    backgroundColor: ColoresApp.primarioFondo,
    borderColor: ColoresApp.primario,
  },
  chipTexto: { fontSize: 12, color: ColoresApp.textoSecundario },
  chipTextoActivo: {
    fontSize: 12,
    color: ColoresApp.primario,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 10,
  },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalButtonCancel: { backgroundColor: ColoresApp.fondo },
  modalButtonSubmit: { backgroundColor: ColoresApp.primario },
});
