import { avisar, useConfirm } from "@/components/ConfirmDialog";
import { ColoresApp } from "@/constants/coloresApp";
import {
  actualizarCarrera,
  agregarCarrera,
  eliminarCarrera,
  obtenerCarreras,
} from "@/services/carrerasServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Carrera = {
  id: number;
  nombre: string;
  tipo?: string | null;
};

export default function GestionarCarrerasScreen() {
  const router = useRouter();
  const confirmar = useConfirm();
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await obtenerCarreras();
      setCarreras(data as Carrera[]);
    } catch {
      avisar("Error", "No se pudieron cargar las carreras.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    let activo = true;

    const cargarDatos = async () => {
      if (!activo) return;

      setCargando(true);

      try {
        const data = await obtenerCarreras();
        if (activo) {
          setCarreras(data as Carrera[]);
        }
      } catch {
        if (activo) {
          avisar("Error", "No se pudieron cargar las carreras.");
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    void cargarDatos();

    return () => {
      activo = false;
    };
  }, []);

  const abrirModalNueva = () => {
    setEditandoId(null);
    setNombre("");
    setTipo("");
    setModalVisible(true);
  };

  const abrirModalEdicion = (carrera: Carrera) => {
    setEditandoId(carrera.id);
    setNombre(carrera.nombre ?? "");
    setTipo(carrera.tipo ?? "");
    setModalVisible(true);
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setEditandoId(null);
    setNombre("");
    setTipo("");
  };

  const guardarCarrera = async () => {
    const nombreTrim = nombre.trim();
    const tipoTrim = tipo.trim();

    if (!nombreTrim) {
      avisar("Falta información", "Escribe el nombre de la carrera.");
      return;
    }

    try {
      if (editandoId != null) {
        const ok = await actualizarCarrera(
          editandoId,
          nombreTrim,
          tipoTrim || "General",
        );
        if (!ok) {
          avisar(
            "No se pudo editar",
            "La carrera no se pudo actualizar. Revisa permisos de Supabase o si la fila está bloqueada por otra relación.",
          );
          return;
        }
      } else {
        const creada = await agregarCarrera(nombreTrim, tipoTrim || "General");
        if (!creada) {
          avisar("Error", "No se pudo crear la carrera.");
          return;
        }
      }

      await cargar();
      cerrarModal();
    } catch {
      avisar("Error", "Ocurrió un problema al guardar la carrera.");
    }
  };

  const handleEliminar = (id: number) => {
    confirmar({
      titulo: "Eliminar carrera",
      mensaje: "¿Deseas eliminar esta carrera del sistema?",
      textoConfirmar: "Eliminar",
      destructivo: true,
      onConfirmar: async () => {
        const ok = await eliminarCarrera(id);
        if (!ok) {
          avisar(
            "No se puede eliminar",
            "La carrera está en uso o la base de datos la bloquea por políticas de seguridad. Revisa si está asociada a aspirantes, materiales o exámenes.",
          );
          return;
        }
        await cargar();
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Carreras y programas" }} />

      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/panel")
          }
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={ColoresApp.primario} />
        </Pressable>
        <Text style={styles.title}>Carreras y programas</Text>
        <Pressable style={styles.addButton} onPress={abrirModalNueva}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>Agregar</Text>
        </Pressable>
      </View>

      {cargando ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={ColoresApp.primario} />
        </View>
      ) : (
        <FlatList
          data={carreras}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay carreras registradas.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.nombre}</Text>
                <Text style={styles.cardType}>{item.tipo ?? "General"}</Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.iconButton}
                  onPress={() => abrirModalEdicion(item)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={ColoresApp.primario}
                  />
                </Pressable>
                <Pressable
                  style={styles.iconButtonDelete}
                  onPress={() => handleEliminar(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editandoId != null ? "Editar carrera" : "Nueva carrera"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre de la carrera"
              value={nombre}
              onChangeText={setNombre}
            />

            <TextInput
              style={styles.input}
              placeholder="Tipo o modalidad (opcional)"
              value={tipo}
              onChangeText={setTipo}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={cerrarModal}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>

              <Pressable style={styles.saveButton} onPress={guardarCarrera}>
                <Text style={styles.saveText}>
                  {editandoId != null ? "Guardar" : "Crear"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  backButton: {
    padding: 6,
  },
  title: {
    flex: 1,
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
    color: ColoresApp.oscuro,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ColoresApp.primario,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    marginLeft: 4,
    color: "white",
    fontWeight: "700",
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ColoresApp.oscuro,
  },
  cardType: {
    marginTop: 4,
    fontSize: 12,
    color: ColoresApp.textoSecundario,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ColoresApp.primarioFondo,
  },
  iconButtonDelete: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ColoresApp.error,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    color: ColoresApp.textoSecundario,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: ColoresApp.oscuro,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: ColoresApp.texto,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: ColoresApp.fondo,
  },
  cancelText: {
    color: ColoresApp.textoSecundario,
    fontWeight: "600",
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: ColoresApp.primario,
  },
  saveText: {
    color: "white",
    fontWeight: "700",
  },
});