import { useConfirm } from "@/components/ConfirmDialog";
import { ColoresApp } from "@/constants/coloresApp";
import {
  actualizarAsistencia,
  eliminarAspirante,
  obtenerAspirantesPorCarrera,
  reactivarExamenAspirante,
} from "@/services/aspirantesServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import {
  corregirRespuestaAspirante,
  obtenerRespuestasDeAspirante,
} from "@/services/examenServicio";
import { obtenerPreguntas } from "@/services/preguntasExamenesServicio";
import { aspiranteFromMap, type Aspirante } from "@/types/aspirante";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

type Carrera = { id: number; nombre: string };

// Filtros disponibles para la lista de aspirantes de la carrera seleccionada.
type FiltroEstado =
  | "todos"
  | "pendiente"
  | "en_progreso"
  | "en_revision"
  | "terminado";

const FILTROS: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "pendiente", etiqueta: "Falta" },
  { valor: "en_progreso", etiqueta: "En curso" },
  { valor: "en_revision", etiqueta: "Por revisar" },
  { valor: "terminado", etiqueta: "Listo" },
];

// Estructura de una pregunta ya combinada con la respuesta capturada
// por el aspirante, lista para mostrarse/evaluarse en el modal de revisión.
type PreguntaConRespuesta = {
  idPregunta: number;
  idRespuesta: number | null;
  pregunta: string;
  materia: string;
  tipo: string;
  opcionA?: string;
  opcionB?: string;
  opcionC?: string;
  opcionD?: string;
  respuestaCorrecta: string;
  respuestaAspirante: string | null;
};

// --- COMPONENTES REUTILIZABLES ---

const Placeholder = ({
  icon,
  mensaje,
  subtitulo,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  mensaje: string;
  subtitulo?: string;
}) => (
  <View style={styles.placeholderContainer}>
    <View style={styles.placeholderCard}>
      <View style={styles.placeholderIconoWrap}>
        <Ionicons name={icon} size={40} color={ColoresApp.primario} />
      </View>
      <Text style={styles.placeholderText}>{mensaje}</Text>
      {subtitulo && (
        <Text style={styles.placeholderSubtexto}>{subtitulo}</Text>
      )}
    </View>
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
  onVerExamen,
  onReactivar,
  onEliminar,
}: {
  aspirante: Aspirante;
  onSelect: () => void;
  onVerExamen: () => void;
  onReactivar: () => void;
  onEliminar: () => void;
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
    <Pressable
      style={({ pressed }) => [
        styles.aspiranteCard,
        pressed && styles.aspiranteCardPresionada,
      ]}
      onPress={onSelect}
    >
      <View style={styles.aspiranteCardFilaSuperior}>
        <View style={[styles.avatar, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.avatarText, { color }]}>
            {aspirante.nombre[0]}
          </Text>
        </View>
        <View style={styles.aspiranteInfo}>
          <Text style={styles.aspiranteNombre} numberOfLines={1}>
            {aspirante.nombre}
          </Text>
          <Text style={styles.aspiranteFolio}>Folio: {aspirante.folio}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={ColoresApp.borde}
        />
      </View>

      <View style={styles.aspiranteCardFilaInferior}>
        <View style={styles.aspiranteBadges}>
          {tieneCalificacion && (
            <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
              <Text style={[styles.badgeText, { color }]}>
                {aspirante.resultado}%
              </Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
            <View style={[styles.badgeDot, { backgroundColor: color }]} />
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>
        </View>

        <View style={styles.aspiranteAcciones}>
          {aspirante.estado !== "pendiente" && (
            <Pressable
              onPress={onVerExamen}
              hitSlop={8}
              style={styles.aspiranteAccionBoton}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={ColoresApp.primario}
              />
            </Pressable>
          )}
          {(aspirante.estado === "terminado" ||
            aspirante.estado === "en_revision") && (
            <Pressable
              onPress={onReactivar}
              hitSlop={8}
              style={styles.aspiranteAccionBoton}
            >
              <Ionicons
                name="reload-circle-outline"
                size={20}
                color={ColoresApp.advertencia}
              />
            </Pressable>
          )}
          <Pressable
            onPress={onEliminar}
            hitSlop={8}
            style={styles.aspiranteAccionBoton}
          >
            <Ionicons name="trash-outline" size={18} color={ColoresApp.error} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

const InfoCard = ({
  icon,
  label,
  valor,
  color = ColoresApp.primario,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor?: string;
  color?: string;
  children?: React.ReactNode;
}) => (
  <View style={styles.infoCard}>
    <View style={[styles.infoCardIcono, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <View style={styles.infoCardTextos}>
      <Text style={styles.infoLabel}>{label}</Text>
      {valor !== undefined ? (
        <Text style={styles.infoValor}>{valor}</Text>
      ) : (
        children
      )}
    </View>
  </View>
);

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
}) => {
  const tieneCalificacion =
    aspirante?.estado === "terminado" && aspirante.resultado != null;
  const aprobado = tieneCalificacion && (aspirante!.resultado ?? 0) >= 70;
  const colorEstado = !aspirante
    ? ColoresApp.primario
    : aspirante.estado === "en_revision"
    ? ColoresApp.advertencia
    : aspirante.estado === "en_progreso"
    ? ColoresApp.primario
    : aspirante.estado === "terminado"
    ? tieneCalificacion
      ? aprobado
        ? ColoresApp.exito
        : ColoresApp.error
      : ColoresApp.primario
    : ColoresApp.textoSecundario;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: ColoresApp.fondo }}>
        <LinearGradient
          colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalHeaderGradient}
        >
          <Pressable onPress={onClose} style={styles.modalCerrarBoton}>
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
          {aspirante && (
            <View style={styles.modalPerfilFila}>
              <View
                style={[
                  styles.modalAvatar,
                  { backgroundColor: `${colorEstado}30` },
                ]}
              >
                <Text style={[styles.modalAvatarTexto, { color: "white" }]}>
                  {aspirante.nombre[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{aspirante.nombre}</Text>
                <Text style={styles.modalSubtitle}>
                  Folio: {aspirante.folio}
                </Text>
              </View>
              {tieneCalificacion && (
                <View
                  style={[
                    styles.modalCalifBadge,
                    { backgroundColor: `${colorEstado}25` },
                  ]}
                >
                  <Text style={[styles.modalCalifTexto, { color: "white" }]}>
                    {aspirante.resultado}%
                  </Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>
        {aspirante && (
          <ScrollView
            contentContainerStyle={styles.modalScrollContenido}
            showsVerticalScrollIndicator={false}
          >
            <InfoCard
              icon="mail-outline"
              label="Correo"
              valor={aspirante.correo || "—"}
            />
            <InfoCard
              icon="school-outline"
              label="Carrera"
              valor={aspirante.carreraNombre}
            />
            <InfoCard
              icon="pulse-outline"
              label="Estado"
              valor={
                aspirante.estado.charAt(0).toUpperCase() +
                aspirante.estado.slice(1).replace("_", " ")
              }
              color={colorEstado}
            />
            {tieneCalificacion && (
              <InfoCard
                icon="ribbon-outline"
                label="Calificación"
                valor={`${aspirante.resultado}% (${
                  aspirante.aciertos ?? 0
                } aciertos)`}
                color={colorEstado}
              />
            )}
            <InfoCard
              icon="checkmark-done-outline"
              label="Asistencia registrada"
              color={aspirante.asistencia ? ColoresApp.exito : ColoresApp.textoSecundario}
            >
              <View style={styles.asistenciaFila}>
                <Text
                  style={[
                    styles.asistenciaEstadoTexto,
                    {
                      color: aspirante.asistencia
                        ? ColoresApp.exito
                        : ColoresApp.textoSecundario,
                    },
                  ]}
                >
                  {aspirante.asistencia ? "Registrada" : "Sin registrar"}
                </Text>
                <Switch
                  value={aspirante.asistencia}
                  onValueChange={(valor) => onToggleAsistencia(aspirante, valor)}
                  trackColor={{
                    false: ColoresApp.borde,
                    true: ColoresApp.exito,
                  }}
                  thumbColor="white"
                />
              </View>
            </InfoCard>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const OpcionRevision = ({
  letra,
  texto,
  esRespuestaAspirante,
  esCorrecta,
  onPress,
}: {
  letra: string;
  texto: string;
  esRespuestaAspirante: boolean;
  esCorrecta: boolean;
  onPress: () => void;
}) => {
  // Colores: la opción correcta siempre se marca en verde; si el
  // aspirante eligió una distinta, esa se marca en rojo para que el
  // admin vea de inmediato el error y pueda corregirlo con un toque.
  let estiloExtra = {};
  let colorLetra = "#9CA3AF";
  if (esCorrecta) {
    estiloExtra = styles.opcionCorrecta;
    colorLetra = ColoresApp.exito ?? "#16A34A";
  } else if (esRespuestaAspirante) {
    estiloExtra = styles.opcionIncorrecta;
    colorLetra = "#DC2626";
  }

  return (
    <Pressable onPress={onPress} style={[styles.opcionRevision, estiloExtra]}>
      <View
        style={[
          styles.opcionRevisionLetra,
          { borderColor: colorLetra },
          (esCorrecta || esRespuestaAspirante) && {
            backgroundColor: colorLetra,
          },
        ]}
      >
        {esRespuestaAspirante || esCorrecta ? (
          <Ionicons
            name={esCorrecta ? "checkmark" : "close"}
            size={14}
            color="white"
          />
        ) : (
          <Text style={styles.opcionRevisionLetraTexto}>{letra}</Text>
        )}
      </View>
      <Text style={styles.opcionRevisionTexto}>{texto}</Text>
      {esRespuestaAspirante && !esCorrecta && (
        <View style={styles.opcionRevisionEtiquetaWrap}>
          <Text style={styles.opcionRevisionEtiqueta}>Marcó esta</Text>
        </View>
      )}
    </Pressable>
  );
};

const ExamenRevisionModal = ({
  visible,
  onClose,
  aspirante,
  preguntas,
  cargando,
  onCorregir,
}: {
  visible: boolean;
  onClose: () => void;
  aspirante: Aspirante | null;
  preguntas: PreguntaConRespuesta[];
  cargando: boolean;
  onCorregir: (pregunta: PreguntaConRespuesta, nuevaLetra: string) => void;
}) => {
  const correctas = preguntas.filter((p) => {
    if (p.tipo === "Abierta") return false;
    return (
      (p.respuestaAspirante ?? "").toUpperCase() ===
      p.respuestaCorrecta.toUpperCase()
    );
  }).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: ColoresApp.fondo }}>
        <LinearGradient
          colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalHeaderGradient}
        >
          <View style={styles.modalHeaderFilaTop}>
            <Pressable
              onPress={onClose}
              style={[styles.modalCerrarBoton, { marginBottom: 0 }]}
            >
              <Ionicons name="close" size={22} color="white" />
            </Pressable>
            {!cargando && preguntas.length > 0 && (
              <View style={styles.modalResumenBadge}>
                <Text style={styles.modalResumenBadgeTexto}>
                  {correctas}/{preguntas.length} correctas
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.modalTitle}>{aspirante?.nombre}</Text>
          <Text style={styles.modalSubtitle}>
            Examen del aspirante — toca una opción para corregirla
          </Text>
        </LinearGradient>
        {cargando ? (
          <ActivityIndicator size="large" style={{ marginTop: 50 }} />
        ) : preguntas.length === 0 ? (
          <Placeholder
            icon="document-text-outline"
            mensaje="Este aspirante aún no tiene respuestas capturadas"
          />
        ) : (
          <ScrollView contentContainerStyle={styles.revisionScrollContenido}>
            {preguntas.map((p, indice) => {
              const esOpcionMultiple = p.tipo !== "Abierta";
              const esCorrecta = esOpcionMultiple
                ? (p.respuestaAspirante ?? "").toUpperCase() ===
                  p.respuestaCorrecta.toUpperCase()
                : null;
              return (
                <View key={p.idPregunta} style={styles.preguntaRevisionCard}>
                  <View style={styles.preguntaRevisionHeader}>
                    <View style={styles.preguntaRevisionNumeroWrap}>
                      <Text style={styles.preguntaRevisionNumero}>
                        {indice + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {!!p.materia && (
                        <Text style={styles.preguntaRevisionMateria}>
                          {p.materia.toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {esOpcionMultiple && (
                      <Ionicons
                        name={
                          esCorrecta ? "checkmark-circle" : "close-circle"
                        }
                        size={20}
                        color={
                          esCorrecta ? ColoresApp.exito : ColoresApp.error
                        }
                      />
                    )}
                  </View>
                  <Text style={styles.preguntaRevisionTexto}>
                    {p.pregunta}
                  </Text>

                  {esOpcionMultiple ? (
                    <View style={{ gap: 8, marginTop: 12 }}>
                      {(
                        [
                          ["A", p.opcionA],
                          ["B", p.opcionB],
                          ["C", p.opcionC],
                          ["D", p.opcionD],
                        ] as [string, string | undefined][]
                      )
                        .filter(([, texto]) => !!texto)
                        .map(([letra, texto]) => (
                          <OpcionRevision
                            key={letra}
                            letra={letra}
                            texto={texto ?? ""}
                            esRespuestaAspirante={
                              (p.respuestaAspirante ?? "").toUpperCase() ===
                              letra
                            }
                            esCorrecta={
                              p.respuestaCorrecta.toUpperCase() === letra
                            }
                            onPress={() => onCorregir(p, letra)}
                          />
                        ))}
                    </View>
                  ) : (
                    <View style={styles.respuestaAbiertaBox}>
                      <Text style={styles.respuestaAbiertaTexto}>
                        {p.respuestaAspirante || "Sin respuesta"}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// --- PANTALLA PRINCIPAL ---

export default function VistaGestionEvaluaciones() {
  const router = useRouter();
  const confirmar = useConfirm();
  const { width } = useWindowDimensions();
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] =
    useState<Carrera | null>(null);
  const [aspirantes, setAspirantes] = useState<Aspirante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [evaluandoAspirante, setEvaluandoAspirante] =
    useState<Aspirante | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");

  // --- Revisión del examen del aspirante (preguntas + respuestas) ---
  const [aspiranteEnRevision, setAspiranteEnRevision] =
    useState<Aspirante | null>(null);
  const [preguntasRevision, setPreguntasRevision] = useState<
    PreguntaConRespuesta[]
  >([]);
  const [cargandoRevision, setCargandoRevision] = useState(false);

  const esAncho = width >= 760;

  const aspirantesFiltrados = useMemo(() => {
    if (filtro === "todos") return aspirantes;
    return aspirantes.filter((a) => a.estado === filtro);
  }, [aspirantes, filtro]);

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

  const handleReactivarExamen = useCallback(
    (aspirante: Aspirante) => {
      // Nota: Alert.alert(title, msg, [botones]) NO funciona en React
      // Native Web (los botones/onPress se pierden en silencio), por eso
      // se usa useConfirm(), que muestra un Modal real multiplataforma.
      confirmar({
        titulo: "Reactivar examen",
        mensaje: `¿Reactivar el examen de ${aspirante.nombre}? Podrá volver a presentarlo.`,
        textoConfirmar: "Reactivar",
        onConfirmar: async () => {
          const exito = await reactivarExamenAspirante(aspirante.id);
          if (exito) {
            setAspirantes((prev) =>
              prev.map((a) =>
                a.id === aspirante.id
                  ? { ...a, estado: "pendiente", resultado: null }
                  : a,
              ),
            );
          } else {
            Alert.alert(
              "Error",
              "No se pudo reactivar el examen (revisa los permisos/RLS en Supabase).",
            );
          }
        },
      });
    },
    [confirmar],
  );

  const handleEliminarAspirante = useCallback(
    (aspirante: Aspirante) => {
      confirmar({
        titulo: "Eliminar aspirante",
        mensaje: `Esta acción borrará a ${aspirante.nombre} y sus respuestas de forma permanente. ¿Continuar?`,
        textoConfirmar: "Eliminar",
        destructivo: true,
        onConfirmar: async () => {
          const exito = await eliminarAspirante(aspirante.id);
          if (exito) {
            setAspirantes((prev) =>
              prev.filter((a) => a.id !== aspirante.id),
            );
            setEvaluandoAspirante((prev) =>
              prev && prev.id === aspirante.id ? null : prev,
            );
          } else {
            Alert.alert(
              "Error",
              "No se pudo eliminar al aspirante (revisa los permisos/RLS en Supabase).",
            );
          }
        },
      });
    },
    [confirmar],
  );

  const handleVerExamen = useCallback(async (aspirante: Aspirante) => {
    setAspiranteEnRevision(aspirante);
    setCargandoRevision(true);
    try {
      const [preguntas, respuestas] = await Promise.all([
        obtenerPreguntas(aspirante.carreraId),
        obtenerRespuestasDeAspirante(aspirante.id),
      ]);

      const respuestasPorPregunta = new Map<number, Record<string, any>>();
      for (const r of respuestas) {
        respuestasPorPregunta.set(r.pregunta_id, r);
      }

      const combinadas: PreguntaConRespuesta[] = preguntas.map((p) => {
        const r = respuestasPorPregunta.get(p.id);
        return {
          idPregunta: p.id,
          idRespuesta: r?.id ?? null,
          pregunta: p.pregunta ?? "",
          materia: p.materia ?? "",
          tipo: p.tipo ?? "Opción múltiple",
          opcionA: p.opcion_a,
          opcionB: p.opcion_b,
          opcionC: p.opcion_c,
          opcionD: p.opcion_d,
          respuestaCorrecta: p.respuesta_correcta ?? "",
          respuestaAspirante: r?.respuesta ?? null,
        };
      });

      setPreguntasRevision(combinadas);
    } catch {
      Alert.alert("Error", "No se pudo cargar el examen del aspirante.");
    } finally {
      setCargandoRevision(false);
    }
  }, []);

  const handleCorregirRespuesta = useCallback(
    (pregunta: PreguntaConRespuesta, nuevaLetra: string) => {
      if (!aspiranteEnRevision) return;
      if (pregunta.respuestaAspirante === nuevaLetra) return;

      Alert.alert(
        "Corregir respuesta",
        `¿Marcar la opción ${nuevaLetra} como la respuesta de este aspirante para esta pregunta?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Confirmar",
            onPress: async () => {
              // Optimistic update
              setPreguntasRevision((prev) =>
                prev.map((p) =>
                  p.idPregunta === pregunta.idPregunta
                    ? { ...p, respuestaAspirante: nuevaLetra }
                    : p,
                ),
              );
              const exito = await corregirRespuestaAspirante(
                aspiranteEnRevision.id,
                pregunta.idPregunta,
                nuevaLetra,
              );
              if (!exito) {
                setPreguntasRevision((prev) =>
                  prev.map((p) =>
                    p.idPregunta === pregunta.idPregunta
                      ? { ...p, respuestaAspirante: pregunta.respuestaAspirante }
                      : p,
                  ),
                );
                Alert.alert("Error", "No se pudo corregir la respuesta.");
                return;
              }
              // Refresca la lista de aspirantes para que la carrera
              // muestre el nuevo % de inmediato al cerrar el modal.
              if (carreraSeleccionada) {
                handleSelectCarrera(carreraSeleccionada);
              }
            },
          },
        ],
      );
    },
    [aspiranteEnRevision, carreraSeleccionada, handleSelectCarrera],
  );

  const panelCarreras = (
    <View style={[esAncho ? styles.sidebar : styles.topbar]}>
      {esAncho && (
        <View style={styles.sidebarTituloFila}>
          <Ionicons
            name="library-outline"
            size={14}
            color={ColoresApp.textoSecundario}
          />
          <Text style={styles.sidebarTitle}>
            CARRERAS ({carreras.length})
          </Text>
        </View>
      )}
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
          subtitulo="Elige una opción del panel izquierdo para ver a sus aspirantes"
        />
      ) : cargando ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : aspirantes.length === 0 ? (
        <Placeholder
          icon="people-outline"
          mensaje="No hay aspirantes registrados en esta carrera"
          subtitulo="Cuando se registren aspirantes aparecerán aquí"
        />
      ) : (
        <>
          <View style={styles.filtrosBar}>
            {FILTROS.map((f) => {
              const activo = filtro === f.valor;
              const cantidad =
                f.valor === "todos"
                  ? aspirantes.length
                  : aspirantes.filter((a) => a.estado === f.valor).length;
              return (
                <Pressable
                  key={f.valor}
                  onPress={() => setFiltro(f.valor)}
                  style={[
                    styles.filtroChip,
                    activo && styles.filtroChipActivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.filtroChipTexto,
                      activo && styles.filtroChipTextoActivo,
                    ]}
                  >
                    {f.etiqueta} ({cantidad})
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {aspirantesFiltrados.length === 0 ? (
            <Placeholder
              icon="filter-outline"
              mensaje="No hay aspirantes con este filtro"
            />
          ) : (
            <FlatList
              data={aspirantesFiltrados}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <AspiranteCard
                  aspirante={item}
                  onSelect={() => setEvaluandoAspirante(item)}
                  onVerExamen={() => handleVerExamen(item)}
                  onReactivar={() => handleReactivarExamen(item)}
                  onEliminar={() => handleEliminarAspirante(item)}
                />
              )}
              contentContainerStyle={styles.aspirantesList}
            />
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Supervisión de Examen" }} />
      <LinearGradient
        colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBar}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/panel");
            }
          }}
          style={styles.topBarBotonIcono}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>
        <Text style={styles.topBarTitulo}>Supervisión de Examen</Text>
        <View style={{ width: 34 }} />
      </LinearGradient>
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
      <ExamenRevisionModal
        visible={!!aspiranteEnRevision}
        aspirante={aspiranteEnRevision}
        preguntas={preguntasRevision}
        cargando={cargandoRevision}
        onClose={() => {
          setAspiranteEnRevision(null);
          setPreguntasRevision([]);
        }}
        onCorregir={handleCorregirRespuesta}
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
    paddingVertical: 14,
  },
  topBarBotonIcono: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  topBarTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
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
  sidebarTituloFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.textoSecundario,
    letterSpacing: 1.2,
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
    padding: 24,
  },
  placeholderCard: {
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    paddingVertical: 40,
    paddingHorizontal: 32,
    maxWidth: 360,
    boxShadow: "0 2px 8px rgba(11,42,74,0.06)",
  },
  placeholderIconoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ColoresApp.primarioFondo,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: "700",
    color: ColoresApp.oscuro,
    textAlign: "center",
  },
  placeholderSubtexto: {
    fontSize: 13,
    color: ColoresApp.textoSecundario,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  aspirantesList: {
    padding: 24,
  },
  aspiranteCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    boxShadow: "0 1px 3px rgba(11,42,74,0.06)",
  },
  aspiranteCardPresionada: {
    backgroundColor: ColoresApp.fondo,
  },
  aspiranteCardFilaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aspiranteCardFilaInferior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: ColoresApp.fondo,
  },
  aspiranteBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  aspiranteAcciones: {
    flexDirection: "row",
    gap: 4,
  },
  aspiranteAccionBoton: {
    padding: 6,
    borderRadius: 8,
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
    marginTop: 2,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    fontSize: 17,
    fontWeight: "bold",
    color: "white",
  },
  filtrosBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  filtroChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
  },
  filtroChipActivo: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
  },
  filtroChipTextoActivo: {
    color: "white",
  },
  revisionScrollContenido: {
    padding: 20,
    gap: 16,
  },
  modalHeaderFilaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalResumenBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalResumenBadgeTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: "white",
  },
  preguntaRevisionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 16,
    boxShadow: "0 1px 4px rgba(11,42,74,0.07)",
  },
  preguntaRevisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  preguntaRevisionNumeroWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: ColoresApp.primarioFondo,
    justifyContent: "center",
    alignItems: "center",
  },
  preguntaRevisionNumero: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.primario,
  },
  preguntaRevisionMateria: {
    fontSize: 11,
    fontWeight: "700",
    color: ColoresApp.textoSecundario,
    letterSpacing: 0.5,
  },
  preguntaRevisionTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: ColoresApp.oscuro,
    lineHeight: 21,
  },
  opcionRevision: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ColoresApp.borde,
    backgroundColor: ColoresApp.fondo,
    gap: 10,
  },
  opcionRevisionCorrectaBase: {},
  opcionCorrecta: {
    backgroundColor: ColoresApp.exitoFondo,
    borderColor: ColoresApp.exito,
  },
  opcionIncorrecta: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderColor: ColoresApp.error,
  },
  opcionRevisionLetra: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  opcionRevisionLetraTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#6B7280",
  },
  opcionRevisionTexto: {
    fontSize: 13.5,
    fontWeight: "500",
    color: ColoresApp.oscuro,
    flex: 1,
  },
  opcionRevisionEtiquetaWrap: {
    backgroundColor: ColoresApp.error,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  opcionRevisionEtiqueta: {
    fontSize: 10,
    fontWeight: "bold",
    color: "white",
  },
  respuestaAbiertaBox: {
    marginTop: 10,
    backgroundColor: ColoresApp.fondo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 12,
  },
  respuestaAbiertaTexto: {
    fontSize: 13,
    color: ColoresApp.oscuro,
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
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
    marginBottom: 2,
  },
  infoValor: {
    fontSize: 14,
    fontWeight: "700",
    color: ColoresApp.oscuro,
  },
  modalHeaderGradient: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  modalCerrarBoton: {
    alignSelf: "flex-end",
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 14,
  },
  modalPerfilFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  modalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  modalAvatarTexto: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  modalCalifBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  modalCalifTexto: {
    fontSize: 15,
    fontWeight: "bold",
  },
  modalScrollContenido: {
    padding: 20,
    gap: 12,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 12,
    boxShadow: "0 1px 3px rgba(11,42,74,0.06)",
  },
  infoCardIcono: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCardTextos: {
    flex: 1,
  },
  asistenciaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  asistenciaEstadoTexto: {
    fontSize: 14,
    fontWeight: "700",
  },
});