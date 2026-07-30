import CampoFechaHora from "@/components/CampoFechaHora";
import { avisar } from "@/components/ConfirmDialog";
import { ColoresApp } from "@/constants/coloresApp";
import {
    actualizarActividad,
    crearActividad,
    eliminarActividad,
    obtenerCronograma,
    type ActividadCronograma,
} from "@/services/cronogramaServicio";
import {
    ETIQUETA_ESTADO_ACTIVIDAD as ETIQUETA_ESTADO,
    estadoDeActividad,
    iconoPorActividad,
} from "@/utils/cronogramaVisualUtils";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useResponsivo } from "@/utils/responsive";import {
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

const COLORES_ETIQUETA = [
  "#7C3AED",
  "#0E9BA8",
  "#F97316",
  "#16A34A",
  "#DC2626",
];

/**
 * Plantillas rápidas: las actividades típicas de un proceso de admisión,
 * para no tener que escribir el título ni elegir color a mano cada vez
 * (herramienta de diseño rápido del cronograma, al estilo de las
 * plantillas/valores por defecto que ya existen en gestionar-preguntas.tsx).
 */
const PLANTILLAS_ACTIVIDAD = [
  { titulo: "Registro de aspirantes", color: "#7C3AED" },
  { titulo: "Aplicación del examen", color: "#0E9BA8" },
  { titulo: "Publicación de resultados", color: "#F97316" },
  { titulo: "Inscripción a materias", color: "#16A34A" },
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Convierte un ISO guardado en BD a "AAAA-MM-DD HH:mm" para precargar el campo. */
function formatoEntradaDesdeISO(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

/**
 * Convierte lo que haya en el campo (escrito a mano o elegido con el
 * calendario) a un Date válido. Acepta con o sin hora, y con espacio o
 * con "T" entre fecha y hora, para no forzarle formato exacto al usuario:
 *   "2026-03-15"          -> 15/mar/2026 00:00
 *   "2026-03-15 09:30"    -> 15/mar/2026 09:30
 *   "2026-03-15T09:30"    -> 15/mar/2026 09:30
 */
function parsearFechaHoraLibre(texto: string): Date | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  const match = limpio.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?$/,
  );
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const fecha = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    h ? Number(h) : 0,
    min ? Number(min) : 0,
  );
  return isNaN(fecha.getTime()) ? null : fecha;
}

const ActividadCard = ({
  actividad,
  onEdit,
  onDelete,
}: {
  actividad: ActividadCronograma;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const fechaInicio = new Date(actividad.fecha_inicio).toLocaleDateString(
    "es-MX",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
  const fechaFin = actividad.fecha_fin
    ? new Date(actividad.fecha_fin).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;
  const estado = estadoDeActividad(actividad);

  return (
    <View style={styles.card}>
      <View
        style={[
          styles.cardIndicator,
          { backgroundColor: actividad.color_etiqueta || ColoresApp.primario },
        ]}
      />
      <View
        style={[
          styles.cardIconCircle,
          {
            backgroundColor: `${actividad.color_etiqueta || ColoresApp.primario}1A`,
          },
        ]}
      >
        <Ionicons
          name={iconoPorActividad(actividad.titulo)}
          size={18}
          color={actividad.color_etiqueta || ColoresApp.primario}
        />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTituloRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {actividad.titulo}
          </Text>
          <View
            style={[
              styles.badgeEstado,
              { backgroundColor: `${ETIQUETA_ESTADO[estado].color}22` },
            ]}
          >
            <Text
              style={[
                styles.badgeEstadoTexto,
                { color: ETIQUETA_ESTADO[estado].color },
              ]}
            >
              {ETIQUETA_ESTADO[estado].texto}
            </Text>
          </View>
        </View>
        <Text style={styles.cardDate}>
          {fechaInicio} {fechaFin ? ` - ${fechaFin}` : ""}
        </Text>
        {actividad.descripcion && (
          <Text style={styles.cardDescription}>{actividad.descripcion}</Text>
        )}
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={onEdit} hitSlop={8}>
          <Ionicons
            name="create-outline"
            size={20}
            color={ColoresApp.textoSecundario}
          />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons
            name="trash-outline"
            size={20}
            color={ColoresApp.textoSecundario}
          />
        </Pressable>
      </View>
    </View>
  );
};

const ActividadModal = ({
  visible,
  onClose,
  onSave,
  actividadInicial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (actividad: Omit<ActividadCronograma, "id" | "creado_en">) => void;
  actividadInicial?: ActividadCronograma | null;
}) => {

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [color, setColor] = useState(COLORES_ETIQUETA[0]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (visible) {
        setTitulo(actividadInicial?.titulo || "");
        setDescripcion(actividadInicial?.descripcion || "");
        setFechaInicio(
          actividadInicial ? formatoEntradaDesdeISO(actividadInicial.fecha_inicio) : "",
        );
        setFechaFin(
          actividadInicial?.fecha_fin
            ? formatoEntradaDesdeISO(actividadInicial.fecha_fin)
            : "",
        );
        setColor(actividadInicial?.color_etiqueta || COLORES_ETIQUETA[0]);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [visible, actividadInicial]);

  const handleSave = async () => {
    if (!titulo.trim() || !fechaInicio.trim()) {
      avisar("Error", "El título y la fecha de inicio son obligatorios.");
      return;
    }
    const inicioDate = parsearFechaHoraLibre(fechaInicio);
    if (!inicioDate) {
      avisar(
        "Error",
        "La fecha de inicio no es válida. Escríbela como AAAA-MM-DD o AAAA-MM-DD HH:mm, o elígela con el calendario.",
      );
      return;
    }
    let finDate: Date | null = null;
    if (fechaFin.trim()) {
      finDate = parsearFechaHoraLibre(fechaFin);
      if (!finDate) {
        avisar(
          "Error",
          "La fecha de fin no es válida. Escríbela como AAAA-MM-DD o AAAA-MM-DD HH:mm, o elígela con el calendario.",
        );
        return;
      }
    }
    setGuardando(true);
    try {
      await onSave({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        fecha_inicio: inicioDate.toISOString(),
        fecha_fin: finDate ? finDate.toISOString() : null,
        color_etiqueta: color,
      });
    } catch (err) {
      console.error("Error al guardar actividad:", err);
      avisar("Error", "Ocurrió un problema al guardar la actividad.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            {actividadInicial ? "Editar Actividad" : "Nueva Actividad"}
          </Text>
          {!actividadInicial && (
            <View>
              <Text style={styles.plantillasLabel}>Plantillas rápidas</Text>
              <View style={styles.plantillasFila}>
                {PLANTILLAS_ACTIVIDAD.map((p) => (
                  <Pressable
                    key={p.titulo}
                    style={[styles.plantillaChip, { borderColor: p.color }]}
                    onPress={() => {
                      setTitulo(p.titulo);
                      setColor(p.color);
                    }}
                  >
                    <Text style={[styles.plantillaChipTexto, { color: p.color }]}>
                      {p.titulo}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Título del evento"
            value={titulo}
            onChangeText={setTitulo}
          />
          <TextInput
            style={styles.input}
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />
          <View style={{ gap: 12 }}>
            <CampoFechaHora
              etiqueta="Fecha y hora de inicio"
              valor={fechaInicio}
              onCambiar={setFechaInicio}
              colorAcento={color}
            />
            <CampoFechaHora
              etiqueta="Fecha y hora de fin"
              valor={fechaFin}
              onCambiar={setFechaFin}
              colorAcento={color}
              opcional
            />
          </View>
          <View style={styles.colorSelector}>
            {COLORES_ETIQUETA.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorChip, { backgroundColor: c }]}
              >
                {color === c && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
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
              onPress={handleSave}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Guardar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function GestionarCronogramaScreen() {
  const { esMovil } = useResponsivo();
  const [actividades, setActividades] = useState<ActividadCronograma[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [actividadEditando, setActividadEditando] =
    useState<ActividadCronograma | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const data = await obtenerCronograma();
    setActividades(data);
    setCargando(false);
  }, []);

  useEffect(() => {
    // Se envuelve en un timeout para evitar el error de linter sobre
    // actualizar el estado directamente en un efecto.
    const id = setTimeout(() => {
      cargar();
    }, 0);
    return () => clearTimeout(id);
  }, [cargar]);

  const handleSave = async (
    actividad: Omit<ActividadCronograma, "id" | "creado_en">,
  ) => {
    const esEdicion = !!actividadEditando;
    const exito = esEdicion
      ? await actualizarActividad(actividadEditando.id, actividad)
      : !!(await crearActividad(actividad));

    if (exito) {
      setModalVisible(false);
      setActividadEditando(null);
      cargar();
    } else {
      console.error("Guardar actividad devolvió false/null");
      avisar("Error", "No se pudo guardar la actividad.");
    }
  };

  const handleDelete = (actividad: ActividadCronograma) => {
    const ejecutarEliminar = async () => {
      const exito = await eliminarActividad(actividad.id);
      if (exito) {
        cargar();
      } else {
        console.error("eliminarActividad falló para id:", actividad.id);
        avisar("Error", "No se pudo eliminar la actividad.");
      }
    };

    // Alert.alert con botones no muestra ningún diálogo en web (queda en
    // silencio), así que ahí usamos window.confirm en su lugar.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (
        window.confirm(
          `¿Eliminar "${actividad.titulo}"? Se eliminará de forma permanente.`,
        )
      ) {
        ejecutarEliminar();
      }
      return;
    }

    Alert.alert(
      "¿Eliminar actividad?",
      `Se eliminará "${actividad.titulo}" de forma permanente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: ejecutarEliminar,
        },
      ],
    );
  };

  const renderContent = () => {
    if (cargando && actividades.length === 0) {
      return <ActivityIndicator style={{ marginTop: 50 }} size="large" />;
    }
    if (actividades.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="calendar-outline"
              size={34}
              color={ColoresApp.primario}
            />
          </View>
          <Text style={styles.emptyTitle}>Aún no hay actividades</Text>
          <Text style={styles.emptyText}>
            Crea la primera actividad del cronograma: inscripciones, examen,
            resultados, inscripción a materias, etc.
          </Text>
          <Pressable
            style={styles.emptyBoton}
            onPress={() => {
              setActividadEditando(null);
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.emptyBotonTexto}>Crear actividad</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <FlatList
        data={actividades}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ActividadCard
            actividad={item}
            onEdit={() => {
              setActividadEditando(item);
              setModalVisible(true);
            }}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Gestionar Cronograma" }} />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitulo}>Cronograma de Actividades</Text>
          <Text style={styles.topBarSubtitulo}>
            {actividades.length === 0
              ? "Fechas clave del proceso de admisión"
              : `${actividades.length} actividad${
                  actividades.length === 1 ? "" : "es"
                } programada${actividades.length === 1 ? "" : "s"}`}
          </Text>
        </View>
      </View>
      {renderContent()}
      {actividades.length > 0 && (
        <Pressable
          style={[styles.fab, esMovil && styles.fabMovil]}
          onPress={() => {
            setActividadEditando(null);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="white" />
          {!esMovil && <Text style={styles.fabText}>Nueva Actividad</Text>}
        </Pressable>
      )}

      <ActividadModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        actividadInicial={actividadEditando}
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
  topBarSubtitulo: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  listContainer: { padding: 16, paddingBottom: 100 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: `${ColoresApp.primario}14`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: ColoresApp.oscuro,
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    color: ColoresApp.textoSecundario,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 22,
    maxWidth: 320,
  },
  emptyBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: ColoresApp.primario,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptyBotonTexto: { color: "white", fontWeight: "700", fontSize: 14 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
  },
  cardIndicator: { width: 6 },
  cardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginTop: 14,
  },
  cardTituloRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeEstado: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeEstadoTexto: { fontSize: 10, fontWeight: "700" },
  cardContent: { flex: 1, padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: ColoresApp.oscuro, flexShrink: 1 },
  cardDate: { fontSize: 12, color: ColoresApp.textoSecundario, marginTop: 2 },
  cardDescription: { fontSize: 12, color: ColoresApp.texto, marginTop: 6 },
  cardActions: { padding: 14, gap: 16 },
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
  fabMovil: { paddingVertical: 14, paddingHorizontal: 14, bottom: 20, right: 16 },
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
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: ColoresApp.oscuro,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 9,
    padding: 12,
    fontSize: 14,
    color: ColoresApp.texto,
  },
  colorSelector: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 8,
  },
  plantillasLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
    marginBottom: 6,
  },
  plantillasFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  plantillaChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  plantillaChipTexto: {
    fontSize: 12,
    fontWeight: "600",
  },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
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