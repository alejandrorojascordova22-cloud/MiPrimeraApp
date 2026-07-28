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
      {aspirante.estado !== "pendiente" && (
        <Pressable onPress={onVerExamen} hitSlop={8} style={{ marginLeft: 8 }}>
          <Ionicons
            name="document-text-outline"
            size={20}
            color={ColoresApp.primario}
          />
        </Pressable>
      )}
      {(aspirante.estado === "terminado" ||
        aspirante.estado === "en_revision") && (
        <Pressable onPress={onReactivar} hitSlop={8} style={{ marginLeft: 8 }}>
          <Ionicons name="reload-circle-outline" size={22} color="orange" />
        </Pressable>
      )}
      <Pressable onPress={onEliminar} hitSlop={8} style={{ marginLeft: 8 }}>
        <Ionicons name="trash-outline" size={20} color="#DC2626" />
      </Pressable>
      <Pressable onPress={onSelect} hitSlop={8} style={{ marginLeft: 4 }}>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </Pressable>
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
        <Text style={styles.opcionRevisionEtiqueta}>Marcó esta</Text>
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
}) => (
  <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={styles.modalTitle}>{aspirante?.nombre}</Text>
          <Text style={styles.modalSubtitle}>
            Examen del aspirante — toca una opción para corregirla
          </Text>
        </View>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} />
        </Pressable>
      </View>
      {cargando ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : preguntas.length === 0 ? (
        <Placeholder
          icon="document-text-outline"
          mensaje="Este aspirante aún no tiene respuestas capturadas"
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {preguntas.map((p, indice) => {
            const esOpcionMultiple = p.tipo !== "Abierta";
            return (
              <View key={p.idPregunta} style={styles.preguntaRevisionCard}>
                <View style={styles.preguntaRevisionHeader}>
                  <Text style={styles.preguntaRevisionNumero}>
                    Pregunta {indice + 1}
                  </Text>
                  {!!p.materia && (
                    <Text style={styles.preguntaRevisionMateria}>
                      {p.materia.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.preguntaRevisionTexto}>
                  {p.pregunta}
                </Text>

                {esOpcionMultiple ? (
                  <View style={{ gap: 8, marginTop: 10 }}>
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
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.topBarBotonIcono}
        >
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Supervisión de Examen</Text>
        <View style={{ width: 34 }} />
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
  modalSubtitle: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  filtrosBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  filtroChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: ColoresApp.fondo,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
  },
  filtroChipActivo: {
    backgroundColor: ColoresApp.primarioFondo,
    borderColor: ColoresApp.primario,
  },
  filtroChipTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
  },
  filtroChipTextoActivo: {
    color: ColoresApp.primario,
  },
  preguntaRevisionCard: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 16,
  },
  preguntaRevisionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  preguntaRevisionNumero: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.primario,
  },
  preguntaRevisionMateria: {
    fontSize: 11,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
  },
  preguntaRevisionTexto: {
    fontSize: 14,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
  opcionRevision: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    gap: 10,
  },
  opcionRevisionCorrectaBase: {},
  opcionCorrecta: {
    backgroundColor: "rgba(22,163,74,0.08)",
    borderColor: "#16A34A",
  },
  opcionIncorrecta: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderColor: "#DC2626",
  },
  opcionRevisionLetra: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  opcionRevisionLetraTexto: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#6B7280",
  },
  opcionRevisionTexto: {
    fontSize: 13,
    color: ColoresApp.oscuro,
    flex: 1,
  },
  opcionRevisionEtiqueta: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#DC2626",
  },
  respuestaAbiertaBox: {
    marginTop: 10,
    backgroundColor: ColoresApp.fondo,
    borderRadius: 10,
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
    fontSize: 13,
    color: ColoresApp.textoSecundario,
  },
  infoValor: {
    fontSize: 13,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
});