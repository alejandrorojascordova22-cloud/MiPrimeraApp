import { ColoresApp } from "@/constants/coloresApp";
import {
  actualizarAsistencia,
  obtenerAspirantesPorCarrera,
} from "@/services/aspirantesServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import { aspiranteFromMap, type Aspirante } from "@/types/aspirante";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

type Carrera = { id: number; nombre: string };

// --- COMPONENTES REUTILIZABLES ---

const Placeholder = ({
  icon,
  mensaje,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  mensaje: string;
}) => (
  <View style={styles.placeholderContainer}>
    <Ionicons name={icon} size={64} color="#E5E7EB" />
    <Text style={styles.placeholderText}>{mensaje}</Text>
  </View>
);

const ListaCarreras = ({
  carreras,
  seleccionada,
  onSelect,
  vertical,
}: {
  carreras: Carrera[];
  seleccionada: Carrera | null;
  onSelect: (c: Carrera) => void;
  vertical: boolean;
}) => {
  const renderItem = ({ item }: { item: Carrera }) => {
    const esActiva = seleccionada?.id === item.id;
    return (
      <Pressable
        style={[
          vertical ? styles.carreraItemVertical : styles.carreraItemHorizontal,
          esActiva &&
            (vertical
              ? styles.carreraItemVerticalActivo
              : styles.carreraItemHorizontalActivo),
        ]}
        onPress={() => onSelect(item)}
      >
        {vertical && (
          <View
            style={[
              styles.carreraIndicator,
              {
                backgroundColor: esActiva ? ColoresApp.primario : "transparent",
              },
            ]}
          />
        )}
        <Text
          style={[
            vertical
              ? styles.carreraTextoVertical
              : styles.carreraTextoHorizontal,
            esActiva && styles.carreraTextoActivo,
          ]}
        >
          {item.nombre}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={carreras}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      horizontal={!vertical}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={
        vertical ? styles.carrerasListaVertical : styles.carrerasListaHorizontal
      }
    />
  );
};

const AspiranteCard = ({
  aspirante,
  onSelect,
}: {
  aspirante: Aspirante;
  onSelect: () => void;
}) => {
  const tieneCalificacion =
    aspirante.estado === "terminado" && aspirante.resultado != null;
  const aprobado = tieneCalificacion && (aspirante.resultado ?? 0) >= 70;

  const getEstadoInfo = () => {
    if (aspirante.estado === "en_revision")
      return { color: ColoresApp.advertencia, label: "Por revisar" };
    if (aspirante.estado === "en_progreso")
      return { color: ColoresApp.primario, label: "En progreso" };
    if (aspirante.estado === "terminado") {
      if (!tieneCalificacion)
        return { color: ColoresApp.primario, label: "Evaluado" };
      return {
        color: aprobado ? ColoresApp.exito : "#DC2626",
        label: "Calificado",
      };
    }
    return { color: ColoresApp.textoSecundario, label: "Pendiente" };
  };

  const { color, label } = getEstadoInfo();

  return (
    <Pressable style={styles.aspiranteCard} onPress={onSelect}>
      <View style={[styles.avatar, { backgroundColor: `${color}20` }]}>
        <Text style={[styles.avatarText, { color }]}>
          {aspirante.nombre[0]}
        </Text>
      </View>
      <View style={styles.aspiranteInfo}>
        <Text style={styles.aspiranteNombre}>{aspirante.nombre}</Text>
        <Text style={styles.aspiranteFolio}>Folio: {aspirante.folio}</Text>
      </View>
      {tieneCalificacion && (
        <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
          <Text style={[styles.badgeText, { color }]}>
            {aspirante.resultado}%
          </Text>
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </Pressable>
  );
};

const PerfilEvaluacionModal = ({
  visible,
  onClose,
  aspirante,
  onToggleAsistencia,
}: {
  visible: boolean;
  onClose: () => void;
  aspirante: Aspirante | null;
  onToggleAsistencia: (aspirante: Aspirante, valor: boolean) => void;
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{aspirante?.nombre}</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} />
        </Pressable>
      </View>
      {aspirante && (
        <View style={{ padding: 20, gap: 16 }}>
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Folio</Text>
            <Text style={styles.infoValor}>{aspirante.folio}</Text>
          </View>
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValor}>{aspirante.correo || "—"}</Text>
          </View>
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Carrera</Text>
            <Text style={styles.infoValor}>{aspirante.carreraNombre}</Text>
          </View>
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={styles.infoValor}>{aspirante.estado}</Text>
          </View>
          {aspirante.estado === "terminado" && aspirante.resultado != null && (
            <View style={styles.infoFila}>
              <Text style={styles.infoLabel}>Calificación</Text>
              <Text style={styles.infoValor}>
                {aspirante.resultado}% ({aspirante.aciertos ?? 0} aciertos)
              </Text>
            </View>
          )}
          <View style={styles.infoFila}>
            <Text style={styles.infoLabel}>Asistencia registrada</Text>
            <Switch
              value={aspirante.asistencia}
              onValueChange={(valor) => onToggleAsistencia(aspirante, valor)}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  </Modal>
);

// --- PANTALLA PRINCIPAL ---

export default function VistaGestionEvaluaciones() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] =
    useState<Carrera | null>(null);
  const [aspirantes, setAspirantes] = useState<Aspirante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [evaluandoAspirante, setEvaluandoAspirante] =
    useState<Aspirante | null>(null);

  const esAncho = width >= 760;

  const cargarCarreras = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await obtenerCarreras();
      setCarreras(lista.map((c) => ({ id: c.id, nombre: c.nombre })));
    } catch {
      Alert.alert("Error", "No se pudieron cargar las carreras.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Se envuelve en un timeout para evitar un falso positivo de la regla
    // `set-state-in-effect` cuando la función de carga está en un useCallback.
    const id = setTimeout(() => {
      cargarCarreras();
    }, 0);
    return () => clearTimeout(id);
  }, [cargarCarreras]);

  const handleSelectCarrera = useCallback(async (carrera: Carrera) => {
    setCarreraSeleccionada(carrera);
    setCargando(true);
    try {
      const filas = await obtenerAspirantesPorCarrera(carrera.id);
      const lista = filas.map((fila) =>
        aspiranteFromMap({
          ...fila,
          carrera_nombre: carrera.nombre,
          carrera_id: carrera.id,
        }),
      );
      setAspirantes(lista);
    } catch {
      Alert.alert(
        "Error",
        `No se pudieron cargar los aspirantes de ${carrera.nombre}.`,
      );
    } finally {
      setCargando(false);
    }
  }, []);

  const handleToggleAsistencia = useCallback(
    async (aspirante: Aspirante, valor: boolean) => {
      // Optimistic update, tanto en la lista como en el modal abierto
      setAspirantes((prev) =>
        prev.map((a) =>
          a.id === aspirante.id ? { ...a, asistencia: valor } : a,
        ),
      );
      setEvaluandoAspirante((prev) =>
        prev && prev.id === aspirante.id
          ? { ...prev, asistencia: valor }
          : prev,
      );

      const exito = await actualizarAsistencia(aspirante.id, valor);
      if (!exito) {
        // Revertir si falla
        setAspirantes((prev) =>
          prev.map((a) =>
            a.id === aspirante.id ? { ...a, asistencia: !valor } : a,
          ),
        );
        setEvaluandoAspirante((prev) =>
          prev && prev.id === aspirante.id
            ? { ...prev, asistencia: !valor }
            : prev,
        );
        Alert.alert("Error", "No se pudo actualizar la asistencia.");
      }
    },
    [],
  );

  const panelCarreras = (
    <View style={[esAncho ? styles.sidebar : styles.topbar]}>
      {esAncho && <Text style={styles.sidebarTitle}>CARRERAS</Text>}
      <ListaCarreras
        carreras={carreras}
        seleccionada={carreraSeleccionada}
        onSelect={handleSelectCarrera}
        vertical={esAncho}
      />
    </View>
  );

  const panelPrincipal = (
    <View style={styles.mainPanel}>
      {!carreraSeleccionada ? (
        <Placeholder
          icon="school-outline"
          mensaje="Selecciona una carrera para gestionar evaluaciones"
        />
      ) : cargando ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : aspirantes.length === 0 ? (
        <Placeholder
          icon="people-outline"
          mensaje="No hay aspirantes registrados en esta carrera"
        />
      ) : (
        <FlatList
          data={aspirantes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <AspiranteCard
              aspirante={item}
              onSelect={() => setEvaluandoAspirante(item)}
            />
          )}
          contentContainerStyle={styles.aspirantesList}
        />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Supervisión de Examen" }} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.topBarBotonIcono}
        >
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Supervisión de Examen</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable
            onPress={() => router.push("/carga-masiva")}
            style={styles.topBarBotonIcono}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={22}
              color={ColoresApp.oscuro}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push("/registro-aspirante")}
            style={styles.topBarBotonIcono}
          >
            <Ionicons
              name="person-add-outline"
              size={22}
              color={ColoresApp.oscuro}
            />
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: esAncho ? "row" : "column", flex: 1 }}>
        {panelCarreras}
        {panelPrincipal}
      </View>
      <PerfilEvaluacionModal
        visible={!!evaluandoAspirante}
        aspirante={evaluandoAspirante}
        onClose={() => setEvaluandoAspirante(null)}
        onToggleAsistencia={handleToggleAsistencia}
      />
    </View>
  );
}

// --- ESTILOS ---

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
    backgroundColor: "white",
  },
  topBarBotonIcono: {
    padding: 6,
  },
  topBarTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    color: ColoresApp.oscuro,
  },
  container: {
    flex: 1,
    backgroundColor: ColoresApp.fondo,
  },
  sidebar: {
    width: 260,
    backgroundColor: "white",
    borderRightWidth: 1,
    borderRightColor: ColoresApp.borde,
  },
  topbar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.textoSecundario,
    letterSpacing: 1.2,
    padding: 20,
    paddingBottom: 12,
  },
  carrerasListaVertical: {
    paddingHorizontal: 12,
  },
  carrerasListaHorizontal: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  carreraItemVertical: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  carreraItemVerticalActivo: {
    backgroundColor: ColoresApp.primarioFondo,
  },
  carreraIndicator: {
    width: 4,
    height: 18,
    borderRadius: 4,
    marginRight: 10,
  },
  carreraTextoVertical: {
    fontSize: 13,
    fontWeight: "500",
    color: ColoresApp.oscuro,
  },
  carreraItemHorizontal: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 99,
    marginHorizontal: 4,
    backgroundColor: ColoresApp.fondo,
  },
  carreraItemHorizontalActivo: {
    backgroundColor: ColoresApp.primarioFondo,
  },
  carreraTextoHorizontal: {
    fontSize: 12,
    fontWeight: "500",
    color: ColoresApp.texto,
  },
  carreraTextoActivo: {
    color: ColoresApp.primario,
    fontWeight: "bold",
  },
  mainPanel: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  placeholderText: {
    color: ColoresApp.textoSecundario,
  },
  aspirantesList: {
    padding: 24,
  },
  aspiranteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  aspiranteInfo: {
    flex: 1,
  },
  aspiranteNombre: {
    fontWeight: "bold",
    fontSize: 14,
    color: ColoresApp.oscuro,
  },
  aspiranteFolio: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  infoFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  infoLabel: {
    fontSize: 13,
    color: ColoresApp.textoSecundario,
  },
  infoValor: {
    fontSize: 13,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
});
