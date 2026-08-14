import { ColoresApp } from "@/constants/coloresApp";
import { avisar } from "@/components/ConfirmDialog";
import { obtenerCarreras } from "@/services/carrerasServicio";
import {
    actualizarExamen,
    agregarPreguntasBloque,
    crearExamen,
    eliminarExamen,
    eliminarPregunta,
    obtenerTodasPreguntas,
    reemplazarPreguntasDeExamen,
    vincularCarrerasAExamen,
} from "@/services/preguntasExamenesServicio";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatearFechaHoraLegible(valor: string) {
  if (!valor) return "";
  const [fecha, hora] = valor.split("T");
  const [y, m, d] = (fecha || "").split("-").map(Number);
  if (!y || !m || !d) return valor;
  const base = `${d} de ${MESES[m - 1]} de ${y}`;
  return hora ? `${base}, ${hora}` : base;
}

// Campo de fecha y hora real y multiplataforma: se puede escribir a mano
// (sin forzar formato mientras se edita) o elegir con un calendario propio
// con selector de hora, construido sin dependencias nativas, así funciona
// igual en web, iOS y Android (incluido Expo Go).
function CampoFecha({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: any;
}) {
  const [visible, setVisible] = useState(false);
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  const [hora, setHora] = useState(12);
  const [minuto, setMinuto] = useState(0);

  const abrirCalendario = () => {
    const [fechaParte, horaParte] = (value || "").split("T");
    const partes = (fechaParte || "").split("-").map(Number);
    const base =
      partes.length === 3 && partes[0]
        ? new Date(partes[0], partes[1] - 1, partes[2])
        : new Date();
    setMesActual(base.getMonth());
    setAnioActual(base.getFullYear());
    setDiaSeleccionado(partes.length === 3 && partes[0] ? partes[2] : null);
    if (horaParte) {
      const [h, min] = horaParte.split(":").map(Number);
      setHora(Number.isFinite(h) ? h : 12);
      setMinuto(Number.isFinite(min) ? min : 0);
    } else {
      setHora(12);
      setMinuto(0);
    }
    setVisible(true);
  };

  const cambiarMes = (delta: number) => {
    let m = mesActual + delta;
    let a = anioActual;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMesActual(m);
    setAnioActual(a);
  };

  const ajustarHora = (delta: number) => {
    setHora((h) => (h + delta + 24) % 24);
  };
  const ajustarMinuto = (delta: number) => {
    setMinuto((m) => (m + delta + 60) % 60);
  };

  const aplicar = () => {
    if (diaSeleccionado == null) {
      setVisible(false);
      return;
    }
    const nuevo = `${anioActual}-${pad2(mesActual + 1)}-${pad2(
      diaSeleccionado,
    )}T${pad2(hora)}:${pad2(minuto)}`;
    onChange(nuevo);
    setVisible(false);
  };

  const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay();
  const diasDelMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];
  const filas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) {
    filas.push(celdas.slice(i, i + 7));
  }

  const hoy = new Date();
  const esHoy = (dia: number) =>
    dia === hoy.getDate() &&
    mesActual === hoy.getMonth() &&
    anioActual === hoy.getFullYear();

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }, style]}
          value={value}
          onChangeText={onChange}
          placeholder="AAAA-MM-DD HH:mm (escribe o usa el calendario)"
          placeholderTextColor={ACCENT.textoTenue}
        />
        <Pressable
          style={styles.calendarioBotonAbrir}
          onPress={abrirCalendario}
          hitSlop={6}
        >
          <Ionicons name="calendar-outline" size={18} color={ACCENT.primario} />
        </Pressable>
      </View>
      {!!value && (
        <Text style={styles.hintTexto}>{formatearFechaHoraLegible(value)}</Text>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.calendarioOverlay}
          onPress={() => setVisible(false)}
        >
          <Pressable style={styles.calendarioCard} onPress={() => {}}>
            <View style={styles.calendarioHeader}>
              <Pressable onPress={() => cambiarMes(-1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={ACCENT.texto} />
              </Pressable>
              <Text style={styles.calendarioHeaderTexto}>
                {MESES[mesActual]} {anioActual}
              </Text>
              <Pressable onPress={() => cambiarMes(1)} hitSlop={8}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={ACCENT.texto}
                />
              </Pressable>
            </View>

            <View style={styles.calendarioFilaSemana}>
              {DIAS_SEMANA.map((d, i) => (
                <Text key={i} style={styles.calendarioDiaSemana}>
                  {d}
                </Text>
              ))}
            </View>

            {filas.map((fila, i) => (
              <View key={i} style={styles.calendarioFila}>
                {fila.map((dia, j) =>
                  dia === null ? (
                    <View key={j} style={styles.calendarioCelda} />
                  ) : (
                    <Pressable
                      key={j}
                      style={[
                        styles.calendarioCelda,
                        styles.calendarioCeldaTocable,
                        diaSeleccionado === dia &&
                          styles.calendarioCeldaSeleccionada,
                      ]}
                      onPress={() => setDiaSeleccionado(dia)}
                    >
                      <Text
                        style={[
                          styles.calendarioCeldaTexto,
                          esHoy(dia) &&
                            diaSeleccionado !== dia &&
                            styles.calendarioCeldaHoyTexto,
                          diaSeleccionado === dia &&
                            styles.calendarioCeldaSeleccionadaTexto,
                        ]}
                      >
                        {dia}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            ))}

            <View style={styles.calendarioHoraFila}>
              <Text style={styles.calendarioHoraLabel}>Hora</Text>
              <View style={styles.calendarioStepper}>
                <Pressable
                  onPress={() => ajustarHora(-1)}
                  hitSlop={8}
                  style={styles.calendarioStepperBoton}
                >
                  <Ionicons name="remove" size={16} color={ACCENT.texto} />
                </Pressable>
                <Text style={styles.calendarioStepperValor}>
                  {pad2(hora)}:{pad2(minuto)}
                </Text>
                <Pressable
                  onPress={() => ajustarHora(1)}
                  hitSlop={8}
                  style={styles.calendarioStepperBoton}
                >
                  <Ionicons name="add" size={16} color={ACCENT.texto} />
                </Pressable>
              </View>
              <View style={styles.calendarioStepper}>
                <Pressable
                  onPress={() => ajustarMinuto(-5)}
                  hitSlop={8}
                  style={styles.calendarioStepperBoton}
                >
                  <Ionicons name="remove" size={16} color={ACCENT.texto} />
                </Pressable>
                <Text style={styles.calendarioHoraLabel}>min</Text>
                <Pressable
                  onPress={() => ajustarMinuto(5)}
                  hitSlop={8}
                  style={styles.calendarioStepperBoton}
                >
                  <Ionicons name="add" size={16} color={ACCENT.texto} />
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                style={[styles.calendarioBotonCerrar, { flex: 1 }]}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.calendarioBotonCerrarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.calendarioBotonAceptar, { flex: 1 }]}
                onPress={aplicar}
              >
                <Text style={styles.calendarioBotonAceptarTexto}>Aceptar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// --- PALETA COMPLEMENTARIA (acentos que no existen aún en ColoresApp) ---
const ACCENT = {
  primario: "#2563EB",
  primarioOscuro: "#1D4ED8",
  primarioFondo: "#EFF4FF",
  primarioFondoFuerte: "#E1EAFF",
  borde: "#E4E7EC",
  bordeSuave: "#EEF1F5",
  texto: "#101828",
  textoSecundario: "#667085",
  textoTenue: "#98A2B3",
  fondo: "#F7F9FC",
  error: "#BA1A1A",
  errorFondo: "#FEF2F2",
  exito: "#16A34A",
};

// Punto de quiebre a partir del cual mostramos el layout de 3 columnas
// (escritorio). Por debajo de esto, todo se apila verticalmente para que
// funcione bien en teléfonos.
const BREAKPOINT_ESCRITORIO = 980;

// --- TIPOS ---
type CarreraRef = { id: number; nombre: string };

type TipoPregunta = "Opción múltiple" | "Abierta" | "Imagen" | "Audio";

type Pregunta = {
  id: number;
  examen_id: number;
  pregunta: string;
  tipo: TipoPregunta;
  opcion_a?: string;
  opcion_b?: string;
  opcion_c?: string;
  opcion_d?: string;
  respuesta_correcta?: string | null;
  materia: string;
  seccion: string;
  duracion_examen: number;
  carreras: CarreraRef[];
  modo_calificacion: "inmediato" | "programado";
  fecha_publicacion: string | null;
};

type OpcionEnEdicion = {
  letra: string;
  texto: string;
};

type PreguntaEnEdicion = {
  localId: string;
  id?: number; // si ya existe en BD
  texto: string;
  opciones: OpcionEnEdicion[];
  respuestaCorrecta: string; // letra
  obligatoria: boolean;
  puntaje: string;
};

// --- COMPONENTES REUTILIZABLES (pantalla principal) ---

const StatChip = ({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) => (
  <View style={styles.statChip}>
    <View style={styles.statChipIconWrap}>
      <Ionicons name={icon} color={color} size={16} />
    </View>
    <View style={{ marginLeft: 8 }}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  </View>
);

const FiltroChip = ({
  label,
  seleccionado,
  onSelect,
}: {
  label: string;
  seleccionado: boolean;
  onSelect: () => void;
}) => (
  <Pressable
    onPress={onSelect}
    style={[styles.filtroChip, seleccionado && styles.filtroChipSeleccionado]}
  >
    <Text
      style={[
        styles.filtroChipTexto,
        seleccionado && styles.filtroChipTextoSeleccionado,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const BloqueExamenExpandible = ({
  grupo,
  onEdit,
  onDelete,
  onDeleteBloque,
}: {
  grupo: any;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onDeleteBloque: () => void;
}) => {
  const [expandido, setExpandido] = useState(false);
  const { materia, seccion, duracion_examen, carreras, preguntas } = grupo;

  const subtitulo = [
    `${preguntas.length} reactivo${preguntas.length === 1 ? "" : "s"}`,
    duracion_examen && `${duracion_examen} min`,
    carreras.join(", "),
  ]
    .filter(Boolean)
    .join("  •  ");

  return (
    <View style={styles.bloqueContainer}>
      <Pressable
        style={styles.bloqueHeader}
        onPress={() => setExpandido(!expandido)}
      >
        <View style={styles.bloqueIconWrap}>
          <Ionicons
            name="folder-open-outline"
            size={18}
            color={ACCENT.primario}
          />
        </View>
        <View style={styles.bloqueHeaderText}>
          <Text style={styles.bloqueTitle}>{`${materia} · ${seccion}`}</Text>
          <Text style={styles.bloqueSubtitle} numberOfLines={1}>
            {subtitulo}
          </Text>
        </View>
        <Pressable onPress={onEdit} style={styles.actionButton} hitSlop={6}>
          <Ionicons
            name="create-outline"
            size={18}
            color={ACCENT.textoSecundario}
          />
        </Pressable>
        <Pressable
          onPress={onDeleteBloque}
          style={styles.actionButton}
          hitSlop={6}
        >
          <Ionicons name="trash-outline" size={18} color={ACCENT.error} />
        </Pressable>
        <View style={styles.chevronWrap}>
          <Ionicons
            name={expandido ? "chevron-up" : "chevron-down"}
            size={18}
            color={ACCENT.textoSecundario}
          />
        </View>
      </Pressable>
      {expandido && (
        <View style={styles.preguntasContainer}>
          {preguntas.map((pregunta: Pregunta) => (
            <TarjetaPregunta
              key={pregunta.id}
              pregunta={pregunta}
              onDelete={onDelete}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const TarjetaPregunta = ({
  pregunta,
  onDelete,
}: {
  pregunta: Pregunta;
  onDelete: (id: number) => void;
}) => (
  <View style={styles.preguntaCard}>
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <View style={styles.idBadge}>
          <Text style={styles.idBadgeText}>#{pregunta.id}</Text>
        </View>
        <View style={styles.tipoBadge}>
          <Ionicons name="checkbox-outline" size={11} color={ACCENT.primario} />
          <Text style={styles.tipoBadgeText}>{pregunta.tipo}</Text>
        </View>
      </View>
      <Text style={styles.preguntaTexto} numberOfLines={2}>
        {pregunta.pregunta}
      </Text>
    </View>
    <Pressable
      onPress={() => onDelete(pregunta.id)}
      style={styles.actionButton}
      hitSlop={6}
    >
      <Ionicons name="trash-outline" size={18} color={ACCENT.error} />
    </Pressable>
  </View>
);

function letraPorIndice(idx: number) {
  return String.fromCharCode(65 + idx); // A, B, C, D, E...
}

function nuevaPreguntaVacia(): PreguntaEnEdicion {
  return {
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    texto: "",
    opciones: [
      { letra: "A", texto: "" },
      { letra: "B", texto: "" },
      { letra: "C", texto: "" },
    ],
    respuestaCorrecta: "A",
    obligatoria: true,
    puntaje: "1",
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SELECTOR DE PREGUNTAS — columna izquierda "Preguntas"
// ─────────────────────────────────────────────────────────────────────────
const SelectorPreguntas = ({
  preguntas,
  activaIdx,
  onSeleccionar,
  onAgregar,
  horizontal,
}: {
  preguntas: PreguntaEnEdicion[];
  activaIdx: number;
  onSeleccionar: (idx: number) => void;
  onAgregar: () => void;
  horizontal: boolean;
}) => (
  <View
    style={[styles.selectorWrap, !horizontal && styles.selectorWrapColumna]}
  >
    <View style={styles.selectorHeader}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="list-outline" size={16} color={ACCENT.primario} />
        <Text style={styles.selectorTitulo}>Preguntas</Text>
      </View>
      <View style={styles.contadorPreguntas}>
        <Text style={styles.contadorPreguntasTexto}>
          {preguntas.length} item{preguntas.length === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
    <ScrollView
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={
        horizontal
          ? styles.selectorScrollHorizontal
          : styles.selectorScrollVertical
      }
    >
      {preguntas.map((p, idx) => {
        const activa = idx === activaIdx;
        const sinContenido = !p.texto.trim();
        return (
          <Pressable
            key={p.localId}
            onPress={() => onSeleccionar(idx)}
            style={[
              styles.selectorTab,
              horizontal && styles.selectorTabHorizontal,
              activa && styles.selectorTabActiva,
            ]}
          >
            <Ionicons
              name="reorder-three-outline"
              size={14}
              color={ACCENT.textoTenue}
              style={{ marginRight: 4 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.selectorTabNumero,
                  activa && styles.selectorTabNumeroActivo,
                ]}
              >
                {String(idx + 1).padStart(2, "0")}
              </Text>
              <Text
                style={[
                  styles.selectorTabTexto,
                  activa && styles.selectorTabTextoActivo,
                  sinContenido && styles.selectorTabTextoVacio,
                ]}
                numberOfLines={2}
              >
                {sinContenido ? "Sin enunciado aún…" : p.texto}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onAgregar}
        style={[
          styles.selectorAgregar,
          horizontal && styles.selectorAgregarHorizontal,
        ]}
      >
        <Ionicons name="add-circle" size={18} color={ACCENT.primario} />
        <Text style={styles.selectorAgregarTexto}>Añadir Pregunta</Text>
      </Pressable>
    </ScrollView>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN — resumen de tiempo estimado / dificultad
// ─────────────────────────────────────────────────────────────────────────
const PanelConfiguracion = ({
  tiempoEstimado,
  dificultad,
}: {
  tiempoEstimado: number;
  dificultad: string;
}) => (
  <View style={styles.configPanel}>
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
      }}
    >
      <Ionicons
        name="information-circle-outline"
        size={15}
        color={ACCENT.primario}
      />
      <Text style={styles.configPanelTitulo}>Configuración</Text>
    </View>
    <View style={styles.configFila}>
      <Text style={styles.configLabel}>Tiempo estimado</Text>
      <Text style={styles.configValor}>{tiempoEstimado} min</Text>
    </View>
    <View style={[styles.configFila, { marginTop: 6 }]}>
      <Text style={styles.configLabel}>Dificultad</Text>
      <Text style={[styles.configValor, { color: ACCENT.error }]}>
        {dificultad}
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────
// EDITOR DE LA PREGUNTA ACTIVA — columna central
// ─────────────────────────────────────────────────────────────────────────
const TIPOS_PREGUNTA: {
  tipo: TipoPregunta;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { tipo: "Opción múltiple", icon: "checkbox" },
  { tipo: "Abierta", icon: "create-outline" },
  { tipo: "Imagen", icon: "image-outline" },
  { tipo: "Audio", icon: "mic-outline" },
];

const EditorPreguntaActiva = ({
  p,
  idx,
  total,
  onChange,
  onDelete,
  onMover,
  onAgregarOpcion,
  onEliminarOpcion,
}: {
  p: PreguntaEnEdicion;
  idx: number;
  total: number;
  onChange: (cambios: Partial<PreguntaEnEdicion>) => void;
  onDelete: () => void;
  onMover: (destino: number) => void;
  onAgregarOpcion: () => void;
  onEliminarOpcion: (letra: string) => void;
}) => {
  const actualizarOpcionTexto = (letra: string, texto: string) => {
    onChange({
      opciones: p.opciones.map((o) =>
        o.letra === letra ? { ...o, texto } : o,
      ),
    });
  };

  return (
    <View style={styles.editorCard}>
      <View style={styles.editorTopRow}>
        <View style={styles.editorBadge}>
          <Text style={styles.editorBadgeTexto}>
            Editando pregunta {idx + 1}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: ACCENT.borde,
            marginHorizontal: 10,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Pressable
            onPress={() => onMover(idx - 1)}
            disabled={idx === 0}
            style={styles.botonOrden}
            hitSlop={4}
          >
            <Ionicons
              name="chevron-up"
              size={18}
              color={idx === 0 ? ACCENT.textoTenue : ACCENT.primario}
            />
          </Pressable>
          <Pressable
            onPress={() => onMover(idx + 1)}
            disabled={idx === total - 1}
            style={styles.botonOrden}
            hitSlop={4}
          >
            <Ionicons
              name="chevron-down"
              size={18}
              color={idx === total - 1 ? ACCENT.textoTenue : ACCENT.primario}
            />
          </Pressable>
          <Pressable onPress={onDelete} style={styles.botonOrden} hitSlop={4}>
            <Ionicons
              name="close-circle-outline"
              size={19}
              color={ACCENT.error}
            />
          </Pressable>
        </View>
      </View>

      {/* Tipo de pregunta */}
      <Text style={styles.campoLabelChico}>TIPO DE PREGUNTA</Text>
      <View style={styles.tipoFila}>
        {TIPOS_PREGUNTA.map(({ tipo, icon }) => {
          const activo = tipo === "Opción múltiple"; // único tipo soportado por el backend actual
          return (
            <View
              key={tipo}
              style={[
                styles.tipoBoton,
                activo ? styles.tipoBotonActivo : styles.tipoBotonDeshabilitado,
              ]}
            >
              <Ionicons
                name={icon}
                size={16}
                color={activo ? ACCENT.primario : ACCENT.textoTenue}
              />
              <Text
                style={
                  activo
                    ? styles.tipoBotonActivoTexto
                    : styles.tipoBotonDeshabilitadoTexto
                }
              >
                {tipo}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.tipoNota}>
        Este sistema solo admite preguntas de opción múltiple por ahora.
      </Text>

      {/* Enunciado */}
      <Text style={[styles.campoLabelChico, { marginTop: 14 }]}>
        ENUNCIADO DE LA PREGUNTA *
      </Text>
      <TextInput
        style={styles.enunciadoInput}
        value={p.texto}
        onChangeText={(v) => onChange({ texto: v })}
        placeholder="Escribe el enunciado aquí..."
        placeholderTextColor={ACCENT.textoTenue}
        multiline
      />

      {/* Opciones de respuesta */}
      <View style={styles.opcionesHeaderRow}>
        <Text style={styles.campoLabelChico}>OPCIONES DE RESPUESTA</Text>
        <Text style={styles.hintTexto}>
          Toca el check para marcar la correcta
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {p.opciones.map((o) => {
          const esCorrecta = p.respuestaCorrecta === o.letra;
          return (
            <View
              key={o.letra}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={[
                  styles.letraBadge,
                  esCorrecta && styles.letraBadgeActiva,
                ]}
              >
                <Text
                  style={[
                    styles.letraBadgeTexto,
                    esCorrecta && styles.letraBadgeTextoActiva,
                  ]}
                >
                  {o.letra}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  position: "relative",
                  justifyContent: "center",
                }}
              >
                <TextInput
                  style={[
                    styles.opcionInput,
                    esCorrecta && styles.opcionInputActiva,
                  ]}
                  value={o.texto}
                  onChangeText={(v) => actualizarOpcionTexto(o.letra, v)}
                  placeholder={`Escribe la opción ${o.letra}`}
                  placeholderTextColor={ACCENT.textoTenue}
                />
                <Pressable
                  onPress={() => onChange({ respuestaCorrecta: o.letra })}
                  style={styles.checkBoton}
                  hitSlop={8}
                >
                  <Ionicons
                    name={
                      esCorrecta
                        ? "checkmark-circle"
                        : "checkmark-circle-outline"
                    }
                    size={22}
                    color={esCorrecta ? ACCENT.primario : ACCENT.textoTenue}
                  />
                </Pressable>
              </View>
              {p.opciones.length > 2 && (
                <Pressable
                  onPress={() => onEliminarOpcion(o.letra)}
                  hitSlop={6}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={ACCENT.textoTenue}
                  />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {p.opciones.length < 6 && (
        <Pressable onPress={onAgregarOpcion} style={styles.agregarOpcionBoton}>
          <Ionicons name="add" size={16} color={ACCENT.primario} />
          <Text style={styles.agregarOpcionTexto}>Añadir Opción</Text>
        </Pressable>
      )}

      {/* Obligatoria / Puntaje */}
      <View style={styles.obligatoriaFila}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={styles.campoLabel}>¿Obligatoria?</Text>
          <Pressable
            onPress={() => onChange({ obligatoria: !p.obligatoria })}
            style={[
              styles.toggleBase,
              p.obligatoria && styles.toggleBaseActivo,
            ]}
          >
            <View
              style={[
                styles.toggleBolita,
                p.obligatoria && styles.toggleBolitaActiva,
              ]}
            />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={styles.campoLabel}>Puntaje</Text>
          <TextInput
            style={styles.puntajeInput}
            value={p.puntaje}
            onChangeText={(v) =>
              onChange({ puntaje: v.replace(/[^0-9]/g, "") })
            }
            keyboardType="numeric"
          />
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VISTA PREVIA EN TIEMPO REAL — columna derecha
// ─────────────────────────────────────────────────────────────────────────
const TAMANOS_FUENTE = [14, 16, 18, 20];

const VistaPreviaTiempoReal = ({
  p,
  idx,
  total,
  materia,
}: {
  p: PreguntaEnEdicion;
  idx: number;
  total: number;
  materia: string;
}) => {
  const [tamanoFuente, setTamanoFuente] = useState(16);
  const [alineacion, setAlineacion] = useState<"left" | "center" | "right">(
    "left",
  );
  const [mostrarSelectorFuente, setMostrarSelectorFuente] = useState(false);
  const [dispositivo, setDispositivo] = useState<"movil" | "escritorio">(
    "escritorio",
  );

  const opciones = p.opciones.filter((o) => o.texto.trim().length > 0);
  const esMovil = dispositivo === "movil";

  return (
    <View style={styles.previewWrap}>
      <View style={styles.previewHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="eye-outline" size={14} color={ACCENT.primario} />
          <Text style={styles.previewTitulo}>Vista previa en tiempo real</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            onPress={() => setDispositivo("movil")}
            hitSlop={6}
            style={[
              styles.previewDispositivoBoton,
              esMovil && styles.previewDispositivoBotonActivo,
            ]}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={15}
              color={esMovil ? ACCENT.primario : ACCENT.textoTenue}
            />
          </Pressable>
          <Pressable
            onPress={() => setDispositivo("escritorio")}
            hitSlop={6}
            style={[
              styles.previewDispositivoBoton,
              !esMovil && styles.previewDispositivoBotonActivo,
            ]}
          >
            <Ionicons
              name="desktop-outline"
              size={15}
              color={!esMovil ? ACCENT.primario : ACCENT.textoTenue}
            />
          </Pressable>
        </View>
      </View>

      {/* Barra de herramientas: tamaño de fuente y alineación */}
      <View style={styles.previewToolbar}>
        <Pressable
          onPress={() => setMostrarSelectorFuente((v) => !v)}
          style={styles.fuenteSelector}
        >
          <Text style={styles.fuenteSelectorTexto}>{tamanoFuente}px</Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={ACCENT.textoSecundario}
          />
        </Pressable>
        {mostrarSelectorFuente && (
          <View style={styles.fuenteOpciones}>
            {TAMANOS_FUENTE.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  setTamanoFuente(t);
                  setMostrarSelectorFuente(false);
                }}
                style={styles.fuenteOpcion}
              >
                <Text style={styles.fuenteOpcionTexto}>{t}px</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.alineacionGrupo}>
          {(["left", "center", "right"] as const).map((a) => (
            <Pressable
              key={a}
              onPress={() => setAlineacion(a)}
              style={styles.alineacionBoton}
              hitSlop={4}
            >
              <Ionicons
                name={
                  a === "left"
                    ? "menu-outline"
                    : a === "center"
                      ? "reorder-two-outline"
                      : "menu-outline"
                }
                size={16}
                color={alineacion === a ? ACCENT.primario : ACCENT.textoTenue}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={[styles.previewCanvas, esMovil && styles.previewCanvasMovil]}
      >
        <View style={styles.previewCanvasTop}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            <View style={[styles.previewDot, { backgroundColor: "#F2B8B5" }]} />
            <View style={[styles.previewDot, { backgroundColor: "#FFD9A8" }]} />
            <View style={[styles.previewDot, { backgroundColor: "#A8C7FF" }]} />
          </View>
          <Text style={styles.previewCanvasTopTexto}>
            {materia ? materia.toUpperCase() : "EXAMEN DE ADMISIÓN"}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.previewBody}>
          <Text style={styles.previewBadgePregunta}>
            PREGUNTA {idx + 1} DE {total}
          </Text>
          <Text
            style={[
              styles.previewEnunciado,
              { fontSize: tamanoFuente + 8, textAlign: alineacion },
            ]}
          >
            {p.texto.trim() || "El enunciado de la pregunta aparecerá aquí..."}
          </Text>

          <View style={{ gap: 10, marginTop: 6 }}>
            {opciones.length === 0 ? (
              <Text style={styles.previewSinOpciones}>
                Agrega opciones para ver la vista previa.
              </Text>
            ) : (
              opciones.map((o) => {
                const esCorrecta = p.respuestaCorrecta === o.letra;
                return (
                  <View
                    key={o.letra}
                    style={[
                      styles.previewOpcion,
                      esCorrecta && styles.previewOpcionActiva,
                    ]}
                  >
                    <View
                      style={[
                        styles.previewOpcionLetra,
                        esCorrecta && styles.previewOpcionLetraActiva,
                      ]}
                    >
                      <Text
                        style={[
                          styles.previewOpcionLetraTexto,
                          esCorrecta && styles.previewOpcionLetraTextoActiva,
                        ]}
                      >
                        {o.letra}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.previewOpcionTexto,
                        { fontSize: tamanoFuente - 3 },
                        esCorrecta && styles.previewOpcionTextoActivo,
                      ]}
                      numberOfLines={2}
                    >
                      {o.texto}
                    </Text>
                    {esCorrecta && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={ACCENT.primario}
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={styles.previewFooter}>
          <View style={styles.previewFooterBotonDeshabilitado}>
            <Ionicons name="chevron-back" size={14} color={ACCENT.textoTenue} />
            <Text style={styles.previewFooterTextoDeshabilitado}>Anterior</Text>
          </View>
          <View style={styles.previewFooterBoton}>
            <Text style={styles.previewFooterTexto}>Siguiente</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={ACCENT.primario}
            />
          </View>
        </View>
      </View>

      <View style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={16} color="white" />
        <View style={{ flex: 1 }}>
          <Text style={styles.tipCardTitulo}>Tip de Accesibilidad</Text>
          <Text style={styles.tipCardTexto}>
            Asegúrate de que los colores de las opciones tengan suficiente
            contraste para estudiantes con daltonismo.
          </Text>
        </View>
      </View>
    </View>
  );
};

const SegmentedRow = ({
  opciones,
  valor,
  onCambiar,
}: {
  opciones: { value: string; label: string }[];
  valor: string;
  onCambiar: (v: string) => void;
}) => (
  <View style={styles.segmentedRow}>
    {opciones.map((op) => {
      const activo = op.value === valor;
      return (
        <Pressable
          key={op.value}
          onPress={() => onCambiar(op.value)}
          style={[styles.segmentedItem, activo && styles.segmentedItemActivo]}
        >
          <Text
            style={[
              styles.segmentedItemTexto,
              activo && styles.segmentedItemTextoActivo,
            ]}
          >
            {op.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const EditorBloqueModal = ({
  visible,
  onClose,
  onSave,
  carrerasDisponibles,
  bloqueInicial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (datos: {
    examenId?: number;
    materia: string;
    seccion: string;
    duracionExamen: number;
    carreraIds: number[];
    modoCalificacion: "inmediato" | "programado";
    fechaPublicacion: string | null;
    bloqueoCapturas: boolean;
    bloqueoNavegacion: boolean;
    preguntas: PreguntaEnEdicion[];
  }) => Promise<void>;
  carrerasDisponibles: CarreraRef[];
  bloqueInicial: any | null;
}) => {
  const { width } = useWindowDimensions();

  // Alert.alert con varios botones no funciona en web (react-native-web solo
  // hace un window.alert de solo-lectura y nunca dispara los onPress), así que
  // ahí usamos window.confirm en su lugar para que el botón de eliminar sí
  // ejecute la acción.
  const confirmarAccionInfo = (
    titulo: string,
    mensaje: string,
    onRecuperar: () => void,
    onDescartar: () => void,
  ) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`${titulo}\n\n${mensaje}`)) onRecuperar();
      else onDescartar();
    } else {
      Alert.alert(titulo, mensaje, [
        { text: "Descartar", style: "destructive", onPress: onDescartar },
        { text: "Recuperar", onPress: onRecuperar },
      ]);
    }
  };

  const esEscritorio = width >= BREAKPOINT_ESCRITORIO;

  const preguntasIniciales = useMemo<PreguntaEnEdicion[]>(() => {
    if (!bloqueInicial) return [nuevaPreguntaVacia()];
    const lista = (bloqueInicial.preguntas ?? []).map((p: Pregunta) => {
      const opciones: OpcionEnEdicion[] = [];
      if (p.opcion_a) opciones.push({ letra: "A", texto: p.opcion_a });
      if (p.opcion_b) opciones.push({ letra: "B", texto: p.opcion_b });
      if (p.opcion_c) opciones.push({ letra: "C", texto: p.opcion_c });
      if (p.opcion_d) opciones.push({ letra: "D", texto: p.opcion_d });
      return {
        localId: `existing-${p.id}`,
        id: p.id,
        texto: p.pregunta,
        opciones:
          opciones.length > 0
            ? opciones
            : [
                { letra: "A", texto: "" },
                { letra: "B", texto: "" },
              ],
        respuestaCorrecta: p.respuesta_correcta ?? "A",
        obligatoria: true,
        puntaje: "1",
      };
    });
    return lista.length > 0 ? lista : [nuevaPreguntaVacia()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [materia, setMateria] = useState(bloqueInicial?.materia ?? "");
  const [seccion, setSeccion] = useState(bloqueInicial?.seccion ?? "");
  const [duracion, setDuracion] = useState(
    String(bloqueInicial?.duracion_examen ?? 60),
  );
  const [modoCalificacion, setModoCalificacion] = useState<
    "inmediato" | "programado"
  >(bloqueInicial?.modo_calificacion ?? "inmediato");
  const [fechaPublicacion, setFechaPublicacion] = useState(
    bloqueInicial?.fecha_publicacion
      ? bloqueInicial.fecha_publicacion.slice(0, 16)
      : "",
  );
  const [carrerasSeleccionadas, setCarrerasSeleccionadas] = useState<
    Set<number>
  >(
    () => new Set((bloqueInicial?.carreras ?? []).map((c: CarreraRef) => c.id)),
  );
  const [bloqueoCapturas, setBloqueoCapturas] = useState<boolean>(
    bloqueInicial?.bloqueo_capturas ?? false,
  );
  const [bloqueoNavegacion, setBloqueoNavegacion] = useState<boolean>(
    bloqueInicial?.bloqueo_navegacion ?? false,
  );
  const [preguntas, setPreguntas] =
    useState<PreguntaEnEdicion[]>(preguntasIniciales);
  const [guardando, setGuardando] = useState(false);
  const [preguntaActivaIdx, setPreguntaActivaIdx] = useState(0);
  const [mostrarDatosBloque, setMostrarDatosBloque] = useState(false);

  // ── Autoguardado local + estado de conexión ──
  // Guarda un respaldo del bloque en el dispositivo cada pocos segundos,
  // para no perder el trabajo si se va la conexión a internet o se cierra
  // la app por accidente antes de "Publicar".
  const claveBorrador = `borrador_reactivos_${bloqueInicial?.examen_id ?? "nuevo"}`;
  const [enLinea, setEnLinea] = useState(true);
  const [estadoGuardado, setEstadoGuardado] = useState<
    "guardado" | "guardando" | "pendiente" | "error"
  >("guardado");
  const [borradorRevisado, setBorradorRevisado] = useState(false);

  // Detecta si hay conexión a internet (en web, vía eventos del navegador).
  // Solo mientras el editor está abierto: el <Modal> de React Native
  // mantiene este componente montado aunque esté oculto, así que sin este
  // control el efecto se dispararía cada vez que se carga la pantalla,
  // no solo cuando el usuario realmente abre el editor.
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const id = setTimeout(() => setEnLinea(navigator.onLine), 0);
      const alConectar = () => setEnLinea(true);
      const alDesconectar = () => setEnLinea(false);
      window.addEventListener("online", alConectar);
      window.addEventListener("offline", alDesconectar);
      return () => {
        clearTimeout(id);
        window.removeEventListener("online", alConectar);
        window.removeEventListener("offline", alDesconectar);
      };
    }
  }, [visible]);

  // Al abrir el editor (y solo la primera vez que se abre en esta sesión),
  // revisa si existe un borrador guardado localmente y ofrece recuperarlo.
  const borradorYaRevisadoRef = useRef(false);
  useEffect(() => {
    if (!visible || borradorYaRevisadoRef.current) return;
    borradorYaRevisadoRef.current = true;
    (async () => {
      try {
        const guardadoJson = await AsyncStorage.getItem(claveBorrador);
        if (guardadoJson) {
          const borrador = JSON.parse(guardadoJson);
          const fecha = borrador.guardadoEn
            ? new Date(borrador.guardadoEn).toLocaleString()
            : "una sesión anterior";
          confirmarAccionInfo(
            "Se encontró un borrador sin publicar",
            `Hay cambios de ${fecha} que no llegaste a publicar. ¿Quieres recuperarlos?`,
            () => {
              if (borrador.materia !== undefined) setMateria(borrador.materia);
              if (borrador.seccion !== undefined) setSeccion(borrador.seccion);
              if (borrador.duracion !== undefined)
                setDuracion(borrador.duracion);
              if (borrador.modoCalificacion !== undefined)
                setModoCalificacion(borrador.modoCalificacion);
              if (borrador.fechaPublicacion !== undefined)
                setFechaPublicacion(borrador.fechaPublicacion);
              if (borrador.bloqueoCapturas !== undefined)
                setBloqueoCapturas(borrador.bloqueoCapturas);
              if (borrador.bloqueoNavegacion !== undefined)
                setBloqueoNavegacion(borrador.bloqueoNavegacion);
              if (Array.isArray(borrador.carreraIds))
                setCarrerasSeleccionadas(new Set(borrador.carreraIds));
              if (Array.isArray(borrador.preguntas))
                setPreguntas(borrador.preguntas);
            },
            () => AsyncStorage.removeItem(claveBorrador),
          );
        }
      } finally {
        setBorradorRevisado(true);
      }
    })();
  }, [visible, claveBorrador]);

  // Cuando se cierra el editor, se reinicia el chequeo del borrador para
  // que la próxima vez que se abra (quizá con datos distintos) vuelva a
  // revisar si hay algo pendiente de recuperar.
  useEffect(() => {
    if (!visible) {
      borradorYaRevisadoRef.current = false;
      const id = setTimeout(() => setBorradorRevisado(false), 0);
      return () => clearTimeout(id);
    }
  }, [visible]);

  // Guarda un respaldo local cada vez que algo cambia (con un pequeño
  // retraso para no escribir en cada tecla). Esto NO publica el examen,
  // solo evita perder el trabajo si hay un corte de conexión o de energía.
  // Igual que arriba, solo mientras el editor está realmente abierto.
  useEffect(() => {
    if (!visible || !borradorRevisado) return;
    const idPendiente = setTimeout(() => setEstadoGuardado("pendiente"), 0);
    const timeout = setTimeout(async () => {
      setEstadoGuardado("guardando");
      try {
        const borrador = {
          materia,
          seccion,
          duracion,
          modoCalificacion,
          fechaPublicacion,
          bloqueoCapturas,
          bloqueoNavegacion,
          carreraIds: Array.from(carrerasSeleccionadas),
          preguntas,
          guardadoEn: new Date().toISOString(),
        };
        await AsyncStorage.setItem(claveBorrador, JSON.stringify(borrador));
        setEstadoGuardado("guardado");
      } catch {
        setEstadoGuardado("error");
      }
    }, 1200);
    return () => {
      clearTimeout(idPendiente);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visible,
    materia,
    seccion,
    duracion,
    modoCalificacion,
    fechaPublicacion,
    bloqueoCapturas,
    bloqueoNavegacion,
    carrerasSeleccionadas,
    preguntas,
    borradorRevisado,
  ]);

  const toggleCarrera = (id: number) => {
    setCarrerasSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const actualizarPregunta = (
    localId: string,
    cambios: Partial<PreguntaEnEdicion>,
  ) => {
    setPreguntas((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, ...cambios } : p)),
    );
  };

  const eliminarPreguntaLocal = (localId: string) => {
    setPreguntas((prev) => {
      const nuevaLista = prev.filter((p) => p.localId !== localId);
      return nuevaLista.length > 0 ? nuevaLista : [nuevaPreguntaVacia()];
    });
    setPreguntaActivaIdx((idx) => Math.max(0, idx - 1));
  };

  const moverPregunta = (idx: number, destino: number) => {
    setPreguntas((prev) => {
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(idx, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
    setPreguntaActivaIdx(destino);
  };

  const agregarPregunta = () => {
    setPreguntas((prev) => [...prev, nuevaPreguntaVacia()]);
    setPreguntaActivaIdx(preguntas.length);
  };

  const agregarOpcion = (localId: string) => {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.localId !== localId || p.opciones.length >= 6) return p;
        const nuevaLetra = letraPorIndice(p.opciones.length);
        return {
          ...p,
          opciones: [...p.opciones, { letra: nuevaLetra, texto: "" }],
        };
      }),
    );
  };

  const eliminarOpcion = (localId: string, letra: string) => {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.localId !== localId || p.opciones.length <= 2) return p;
        const opcionesFiltradas = p.opciones
          .filter((o) => o.letra !== letra)
          .map((o, i) => ({ ...o, letra: letraPorIndice(i) }));
        const respuestaCorrecta = opcionesFiltradas.some(
          (o) => o.letra === p.respuestaCorrecta,
        )
          ? p.respuestaCorrecta
          : opcionesFiltradas[0].letra;
        return { ...p, opciones: opcionesFiltradas, respuestaCorrecta };
      }),
    );
  };

  const handleGuardar = async () => {
    if (!materia.trim()) {
      Alert.alert("Falta información", "Escribe la materia del bloque.");
      setMostrarDatosBloque(true);
      return;
    }
    if (carrerasSeleccionadas.size === 0) {
      Alert.alert("Falta información", "Selecciona al menos una carrera.");
      setMostrarDatosBloque(true);
      return;
    }
    if (preguntas.length === 0 || preguntas.some((p) => !p.texto.trim())) {
      Alert.alert(
        "Falta información",
        "Todas las preguntas necesitan su enunciado.",
      );
      return;
    }
    if (
      preguntas.some((p) => p.opciones.filter((o) => o.texto.trim()).length < 2)
    ) {
      Alert.alert(
        "Falta información",
        "Cada pregunta necesita al menos dos opciones con texto.",
      );
      return;
    }

    let fechaPublicacionISO: string | null = null;
    if (modoCalificacion === "programado") {
      const parsed = new Date(fechaPublicacion);
      if (!fechaPublicacion.trim() || isNaN(parsed.getTime())) {
        avisar(
          "Fecha inválida",
          "Escribe la fecha de publicación en formato AAAA-MM-DD o AAAA-MM-DD HH:mm, o elígela con el calendario.",
        );
        return;
      }
      fechaPublicacionISO = parsed.toISOString();
    }

    setGuardando(true);
    try {
      await onSave({
        examenId: bloqueInicial?.examen_id,
        materia: materia.trim(),
        seccion: seccion.trim() || "General",
        duracionExamen: parseInt(duracion, 10) || 60,
        carreraIds: Array.from(carrerasSeleccionadas),
        modoCalificacion: modoCalificacion,
        fechaPublicacion: fechaPublicacionISO,
        bloqueoCapturas,
        bloqueoNavegacion,
        preguntas,
      });
      // Se publicó correctamente: el respaldo local ya no es necesario.
      await AsyncStorage.removeItem(claveBorrador);
    } finally {
      setGuardando(false);
    }
  };

  const preguntaActivaIdxSegura = Math.min(
    preguntaActivaIdx,
    preguntas.length - 1,
  );
  const preguntaActiva = preguntas[preguntaActivaIdxSegura];

  const tiempoEstimadoMin = parseInt(duracion, 10) || 0;
  const dificultad =
    preguntas.length > 20 ? "Alta" : preguntas.length > 8 ? "Media" : "Baja";

  // Estado inicializado directamente a partir de `bloqueInicial`, sin useEffect.
  // El componente se remonta con una `key` distinta cada vez que se abre el
  // modal (ver GestionarPreguntasScreen), así que estos initializers de
  // useState siempre corren "en fresco" para el bloque que se está editando,
  // evitando el patrón de "setState en cascada dentro de un efecto".
  const contenidoEditor = (
    <>
      <Pressable
        style={styles.seccionCardHeader}
        onPress={() => setMostrarDatosBloque((v) => !v)}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="settings-outline" size={15} color={ACCENT.primario} />
          <Text style={styles.seccionCardTitulo}>Datos del bloque</Text>
        </View>
        <Ionicons
          name={mostrarDatosBloque ? "chevron-up" : "chevron-down"}
          size={16}
          color={ACCENT.textoSecundario}
        />
      </Pressable>

      {mostrarDatosBloque && (
        <View style={styles.seccionCard}>
          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Materia</Text>
            <TextInput
              style={styles.input}
              value={materia}
              onChangeText={setMateria}
              placeholder="Ej. Programación"
              placeholderTextColor={ACCENT.textoTenue}
            />
          </View>
          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Sección</Text>
            <TextInput
              style={styles.input}
              value={seccion}
              onChangeText={setSeccion}
              placeholder="Ej. Fundamentos"
              placeholderTextColor={ACCENT.textoTenue}
            />
          </View>
          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Duración (minutos)</Text>
            <TextInput
              style={styles.input}
              value={duracion}
              onChangeText={setDuracion}
              keyboardType="numeric"
              placeholderTextColor={ACCENT.textoTenue}
            />
          </View>
          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Modo de Calificación</Text>
            <SegmentedRow
              opciones={[
                { value: "inmediato", label: "Inmediata" },
                { value: "programado", label: "Programada" },
              ]}
              valor={modoCalificacion}
              onCambiar={(v: any) => setModoCalificacion(v)}
            />
          </View>
          {modoCalificacion === "programado" && (
            <View style={styles.campoGrupo}>
              <Text style={styles.campoLabel}>Fecha de Publicación</Text>
              <CampoFecha
                value={fechaPublicacion}
                onChange={setFechaPublicacion}
              />
              <Text style={styles.hintTexto}>
                Los resultados serán visibles a partir de esta fecha.
              </Text>
            </View>
          )}
          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Carreras vinculadas</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {carrerasDisponibles.map((c) => {
                const activa = carrerasSeleccionadas.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleCarrera(c.id)}
                    style={[
                      styles.carreraChip,
                      activa && styles.carreraChipActiva,
                    ]}
                  >
                    <Text
                      style={[
                        styles.carreraChipTexto,
                        activa && styles.carreraChipTextoActiva,
                      ]}
                    >
                      {c.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.campoGrupo}>
            <Text style={styles.campoLabel}>Seguridad</Text>

            <View style={styles.filaSeguridad}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.filaSeguridadTitulo}>
                  Bloquear capturas de pantalla
                </Text>
                <Text style={styles.hintTexto}>
                  Evita capturas/grabación de pantalla durante el examen (app
                  nativa). En navegador, difumina el contenido y bloquea el
                  menú contextual y el copiado como medida disuasiva.
                </Text>
              </View>
              <Switch
                value={bloqueoCapturas}
                onValueChange={setBloqueoCapturas}
                trackColor={{ true: ACCENT.primario }}
              />
            </View>

            <View style={styles.filaSeguridad}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.filaSeguridadTitulo}>
                  Bloquear cambio de ventana/pestaña
                </Text>
                <Text style={styles.hintTexto}>
                  Anula el intento en cuanto el aspirante cambia de pestaña,
                  minimiza la app o se va a otra ventana, sin margen de
                  advertencia.
                </Text>
              </View>
              <Switch
                value={bloqueoNavegacion}
                onValueChange={setBloqueoNavegacion}
                trackColor={{ true: ACCENT.primario }}
              />
            </View>
          </View>
        </View>
      )}

      {preguntaActiva && (
        <EditorPreguntaActiva
          p={preguntaActiva}
          idx={preguntaActivaIdxSegura}
          total={preguntas.length}
          onChange={(cambios) =>
            actualizarPregunta(preguntaActiva.localId, cambios)
          }
          onDelete={() => eliminarPreguntaLocal(preguntaActiva.localId)}
          onMover={(destino) => moverPregunta(preguntaActivaIdxSegura, destino)}
          onAgregarOpcion={() => agregarOpcion(preguntaActiva.localId)}
          onEliminarOpcion={(letra) =>
            eliminarOpcion(preguntaActiva.localId, letra)
          }
        />
      )}
    </>
  );

  // Layout de columnas: en escritorio se muestran las 3 columnas lado a lado;
  // en tablet, 2 columnas (editor + preview) con el selector arriba;
  // en teléfono, todo apilado verticalmente.

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: ACCENT.fondo }}>
        {/* Header estilo escritorio: flecha atrás, título, iconos de acción, Cancelar / Publicar */}
        <View style={styles.modalHeader}>
          <Pressable
            onPress={onClose}
            style={styles.modalBackButton}
            hitSlop={6}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={ACCENT.textoSecundario}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>Editor de Reactivos</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.modalSubtitle}>
                {bloqueInicial ? "Edición de Bloque" : "Nuevo Bloque"}
                {materia ? ` de ${materia}` : ""}
              </Text>
              <View
                style={[
                  styles.conexionPunto,
                  { backgroundColor: enLinea ? "#3FB27F" : "#E0554A" },
                ]}
              />
              <Text style={styles.conexionTexto}>
                {enLinea ? "En línea" : "Sin conexión"} ·{" "}
                {estadoGuardado === "guardando"
                  ? "guardando respaldo..."
                  : estadoGuardado === "error"
                    ? "error al respaldar"
                    : estadoGuardado === "pendiente"
                      ? "cambios sin respaldar"
                      : "respaldo local al día"}
              </Text>
            </View>
          </View>
          {esEscritorio && (
            <View style={{ flexDirection: "row", gap: 14, marginRight: 14 }}>
              <Pressable
                hitSlop={6}
                onPress={() =>
                  Alert.alert(
                    enLinea ? "Respaldo local" : "Sin conexión a internet",
                    estadoGuardado === "error"
                      ? "No se pudo guardar el respaldo local en este dispositivo. Tus cambios siguen en pantalla, pero intenta guardarlos pronto."
                      : `Tu progreso se guarda automáticamente en este dispositivo cada pocos segundos, aunque se corte el internet.${
                          enLinea
                            ? ""
                            : " En cuanto vuelva la conexión, podrás publicar sin perder nada."
                        } Si cierras el editor sin publicar, te preguntaremos si quieres recuperarlo la próxima vez que lo abras.`,
                  )
                }
              >
                <Ionicons
                  name={
                    !enLinea
                      ? "cloud-offline-outline"
                      : estadoGuardado === "guardando" ||
                          estadoGuardado === "pendiente"
                        ? "cloud-upload-outline"
                        : estadoGuardado === "error"
                          ? "warning-outline"
                          : "cloud-done-outline"
                  }
                  size={19}
                  color={
                    !enLinea || estadoGuardado === "error"
                      ? "#E0554A"
                      : ACCENT.textoSecundario
                  }
                />
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() =>
                  Alert.alert(
                    "Ajustes del editor",
                    "El respaldo automático local está activado y no requiere configuración. Usa el selector de tamaño de letra y alineación en la vista previa para ajustar cómo se verá la pregunta para los aspirantes.",
                  )
                }
              >
                <Ionicons
                  name="settings-outline"
                  size={19}
                  color={ACCENT.textoSecundario}
                />
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() =>
                  Alert.alert(
                    "Ayuda del Editor de Reactivos",
                    "1) Escribe el enunciado y las opciones de respuesta.\n2) Marca con el check cuál es la opción correcta.\n3) Revisa cómo se verá en la vista previa (puedes alternar entre móvil y escritorio).\n4) Presiona Publicar para guardar el bloque. Mientras editas, tu trabajo se respalda automáticamente en este dispositivo.",
                  )
                }
              >
                <Ionicons
                  name="help-circle-outline"
                  size={19}
                  color={ACCENT.textoSecundario}
                />
              </Pressable>
            </View>
          )}
          <Pressable onPress={onClose} style={styles.cancelButtonHeader}>
            <Text style={styles.cancelButtonHeaderText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={styles.saveButtonHeader}
            onPress={handleGuardar}
            disabled={guardando}
          >
            {guardando ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color="white" />
                <Text style={styles.saveButtonHeaderText}>Publicar</Text>
              </>
            )}
          </Pressable>
        </View>

        {esEscritorio ? (
          // ── LAYOUT DE 3 COLUMNAS (escritorio / tablet horizontal) ──
          <View style={styles.layoutEscritorio}>
            <ScrollView
              style={styles.columnaIzquierda}
              contentContainerStyle={{ padding: 14, gap: 12 }}
            >
              <SelectorPreguntas
                preguntas={preguntas}
                activaIdx={preguntaActivaIdxSegura}
                onSeleccionar={setPreguntaActivaIdx}
                onAgregar={agregarPregunta}
                horizontal={false}
              />
              <PanelConfiguracion
                tiempoEstimado={tiempoEstimadoMin}
                dificultad={dificultad}
              />
            </ScrollView>

            <ScrollView
              style={styles.columnaCentral}
              contentContainerStyle={{ padding: 16, gap: 14 }}
            >
              {contenidoEditor}
            </ScrollView>

            <ScrollView
              style={styles.columnaDerecha}
              contentContainerStyle={{ padding: 16 }}
            >
              {preguntaActiva && (
                <VistaPreviaTiempoReal
                  p={preguntaActiva}
                  idx={preguntaActivaIdxSegura}
                  total={preguntas.length}
                  materia={materia}
                />
              )}
            </ScrollView>
          </View>
        ) : (
          // ── LAYOUT APILADO (tablet vertical / teléfono) ──
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
          >
            <SelectorPreguntas
              preguntas={preguntas}
              activaIdx={preguntaActivaIdxSegura}
              onSeleccionar={setPreguntaActivaIdx}
              onAgregar={agregarPregunta}
              horizontal={true}
            />
            {contenidoEditor}
            {preguntaActiva && (
              <VistaPreviaTiempoReal
                p={preguntaActiva}
                idx={preguntaActivaIdxSegura}
                total={preguntas.length}
                materia={materia}
              />
            )}
            <PanelConfiguracion
              tiempoEstimado={tiempoEstimadoMin}
              dificultad={dificultad}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// --- PANTALLA PRINCIPAL ---

export default function GestionarPreguntasScreen() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [carreras, setCarreras] = useState<CarreraRef[]>([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState("Todas");
  const [isEditorVisible, setEditorVisible] = useState(false);
  const [bloqueEnEdicion, setBloqueEnEdicion] = useState<any | null>(null);
  // Se incrementa cada vez que se abre el editor, para forzar un remount
  // limpio del modal (y así inicializar su estado sin necesidad de un
  // useEffect que haga setState en cascada).
  const [editorKey, setEditorKey] = useState(0);
  const [paginaActual, setPaginaActual] = useState(0);
  const TAMANO_PAGINA = 8; // exámenes (bloques) por página

  const confirmarAccion = (
    titulo: string,
    mensaje: string,
    onConfirmar: () => void,
  ) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(`${titulo}\n\n${mensaje}`)) onConfirmar();
      return;
    }
    Alert.alert(titulo, mensaje, [
      { text: "Cancelar" },
      { text: "Eliminar", style: "destructive", onPress: onConfirmar },
    ]);
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [preguntasData, carrerasData] = await Promise.all([
        obtenerTodasPreguntas(),
        obtenerCarreras(),
      ]);
      setPreguntas(preguntasData as Pregunta[]);
      setCarreras(carrerasData.map((c) => ({ id: c.id, nombre: c.nombre })));
    } catch {
      Alert.alert("Error", "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => cargarDatos());
  }, [cargarDatos]);

  const materiasFiltro = useMemo(() => {
    const set = new Set(preguntas.map((p) => p.materia).filter(Boolean));
    return ["Todas", ...Array.from(set)];
  }, [preguntas]);

  const gruposFiltrados = useMemo(() => {
    const filtradas = preguntas.filter(
      (p) =>
        materiaSeleccionada === "Todas" || p.materia === materiaSeleccionada,
    );
    const grupos: Record<number, any> = {};
    for (const p of filtradas) {
      if (!grupos[p.examen_id]) {
        grupos[p.examen_id] = {
          ...p,
          carreras: p.carreras.map((c) => c.nombre),
          carrerasRef: p.carreras,
          preguntas: [],
        };
      }
      grupos[p.examen_id].preguntas.push(p);
    }
    return Object.values(grupos);
  }, [preguntas, materiaSeleccionada]);

  useEffect(() => {
    Promise.resolve().then(() => setPaginaActual(0));
  }, [materiaSeleccionada]);

  const totalGrupos = gruposFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalGrupos / TAMANO_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas - 1);
  const inicioSegmento = paginaSegura * TAMANO_PAGINA;
  const finSegmento = Math.min(inicioSegmento + TAMANO_PAGINA, totalGrupos);
  const gruposSegmentados = gruposFiltrados.slice(inicioSegmento, finSegmento);

  const handleEliminar = (id: number) => {
    confirmarAccion("Confirmar", `¿Eliminar reactivo #${id}?`, async () => {
      const exito = await eliminarPregunta(id);
      if (exito) {
        cargarDatos();
      } else {
        avisar("Error", "No se pudo eliminar el reactivo.");
      }
    });
  };

  const handleEliminarBloque = (grupo: any) => {
    confirmarAccion(
      "Confirmar",
      `¿Eliminar todo el bloque de "${grupo.materia} · ${grupo.seccion}"? Se borrarán sus ${grupo.preguntas.length} preguntas.`,
      async () => {
        const exito = await eliminarExamen(grupo.examen_id);
        if (exito) {
          cargarDatos();
        } else {
          avisar("Error", "No se pudo eliminar el bloque.");
        }
      },
    );
  };

  const handleGuardarBloque = async ({
    examenId,
    materia,
    seccion,
    duracionExamen,
    carreraIds,
    modoCalificacion,
    fechaPublicacion,
    bloqueoCapturas,
    bloqueoNavegacion,
    preguntas: preguntasEditadas,
  }: {
    examenId?: number;
    materia: string;
    seccion: string;
    duracionExamen: number;
    carreraIds: number[];
    modoCalificacion: "inmediato" | "programado";
    fechaPublicacion: string | null;
    bloqueoCapturas: boolean;
    bloqueoNavegacion: boolean;
    preguntas: PreguntaEnEdicion[];
  }) => {
    const payloadPreguntas = preguntasEditadas.map((p) => {
      const porLetra = (letra: string) =>
        p.opciones.find((o) => o.letra === letra)?.texto.trim() ?? "";
      return {
        pregunta: p.texto.trim(),
        tipo: "Opción múltiple" as const,
        opcion_a: porLetra("A"),
        opcion_b: porLetra("B"),
        opcion_c: porLetra("C"),
        opcion_d: porLetra("D"),
        respuesta_correcta: p.respuestaCorrecta,
      };
    });

    try {
      if (examenId) {
        const okExamen = await actualizarExamen(examenId, {
          materia,
          seccion,
          duracion_examen: duracionExamen,
          modo_calificacion: modoCalificacion,
          fecha_publicacion: fechaPublicacion,
          bloqueo_capturas: bloqueoCapturas,
          bloqueo_navegacion: bloqueoNavegacion,
        });
        const okCarreras = await vincularCarrerasAExamen(examenId, carreraIds);
        const okPreguntas = await reemplazarPreguntasDeExamen(
          examenId,
          payloadPreguntas,
        );
        if (!okExamen || !okCarreras || !okPreguntas) {
          Alert.alert(
            "Aviso",
            "El bloque se guardó parcialmente. Revisa la conexión e intenta de nuevo.",
          );
        }
      } else {
        const examen = await crearExamen({
          materia,
          seccion,
          duracion_examen: duracionExamen,
          modo_calificacion: modoCalificacion,
          fecha_publicacion: fechaPublicacion,
          bloqueo_capturas: bloqueoCapturas,
          bloqueo_navegacion: bloqueoNavegacion,
        });
        if (!examen) {
          Alert.alert("Error", "No se pudo crear el bloque.");
          return;
        }
        await vincularCarrerasAExamen(examen.id, carreraIds);
        await agregarPreguntasBloque(
          payloadPreguntas.map((p) => ({ ...p, examen_id: examen.id })),
        );
      }
      setEditorVisible(false);
      setBloqueEnEdicion(null);
      cargarDatos();
    } catch {
      Alert.alert("Error", "Ocurrió un problema al guardar el bloque.");
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Encabezado */}
      <LinearGradient
        colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
        style={styles.headerContainer}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Banco de Reactivos</Text>
            <Text style={styles.headerSubtitle}>
              Gestión de preguntas de opción múltiple
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              style={styles.nuevoButton}
              onPress={() => router.push("/carga-masiva-preguntas")}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={ACCENT.primario} />
              <Text style={styles.nuevoButtonText}>Carga masiva</Text>
            </Pressable>
            <Pressable
              style={styles.nuevoButton}
              onPress={() => {
                setBloqueEnEdicion(null);
                setEditorKey((k) => k + 1);
                setEditorVisible(true);
              }}
            >
              <Ionicons name="add" size={20} color={ACCENT.primario} />
              <Text style={styles.nuevoButtonText}>Nuevo Bloque</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.statsContainer}>
          <StatChip
            icon="library-outline"
            value={preguntas.length.toString()}
            label="Total reactivos"
            color="#FFD700"
          />
          <StatChip
            icon="school-outline"
            value={carreras.length.toString()}
            label="Carreras"
            color="#ADD8E6"
          />
        </View>
        <View>
          <Text style={styles.filtroTitle}>Filtrar por materia</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtrosContainer}
          >
            {materiasFiltro.map((materia) => (
              <FiltroChip
                key={materia}
                label={materia}
                seleccionado={materia === materiaSeleccionada}
                onSelect={() => setMateriaSeleccionada(materia)}
              />
            ))}
          </ScrollView>
        </View>
      </LinearGradient>

      {/* Contenido */}
      {cargando ? (
        <ActivityIndicator
          style={{ marginTop: 50 }}
          size="large"
          color={ACCENT.primario}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.listaContainer}>
            {gruposSegmentados.length > 0 ? (
              gruposSegmentados.map((grupo: any) => (
                <BloqueExamenExpandible
                  key={grupo.examen_id}
                  grupo={grupo}
                  onEdit={() => {
                    setBloqueEnEdicion({
                      ...grupo,
                      carreras: grupo.carrerasRef,
                    });
                    setEditorKey((k) => k + 1);
                    setEditorVisible(true);
                  }}
                  onDelete={handleEliminar}
                  onDeleteBloque={() => handleEliminarBloque(grupo)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconWrap}>
                  <Ionicons
                    name="file-tray-outline"
                    size={40}
                    color={ACCENT.textoTenue}
                  />
                </View>
                <Text style={styles.emptyStateText}>
                  Sin reactivos para este filtro.
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Crea un nuevo bloque para comenzar.
                </Text>
              </View>
            )}
          </ScrollView>
          {totalGrupos > 0 && (
            <View style={styles.footerPaginacion}>
              <Text style={styles.footerPaginacionTexto}>
                Mostrando {inicioSegmento + 1}-{finSegmento} de {totalGrupos}{" "}
                examen(es)
              </Text>
              <View style={styles.footerPaginacionBotones}>
                <Pressable
                  onPress={() => setPaginaActual((p) => Math.max(0, p - 1))}
                  disabled={paginaSegura === 0}
                  style={[
                    styles.paginacionBoton,
                    paginaSegura === 0 && styles.paginacionBotonDeshabilitado,
                  ]}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={
                      paginaSegura === 0 ? ACCENT.textoTenue : ACCENT.primario
                    }
                  />
                </Pressable>
                <Pressable
                  onPress={() =>
                    setPaginaActual((p) => Math.min(totalPaginas - 1, p + 1))
                  }
                  disabled={finSegmento >= totalGrupos}
                  style={[
                    styles.paginacionBoton,
                    finSegmento >= totalGrupos &&
                      styles.paginacionBotonDeshabilitado,
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      finSegmento >= totalGrupos
                        ? ACCENT.textoTenue
                        : ACCENT.primario
                    }
                  />
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      <EditorBloqueModal
        key={String(editorKey)}
        visible={isEditorVisible}
        onClose={() => {
          setEditorVisible(false);
          setBloqueEnEdicion(null);
        }}
        onSave={handleGuardarBloque}
        carrerasDisponibles={carreras}
        bloqueInicial={bloqueEnEdicion}
      />
    </View>
  );
}

// --- ESTILOS ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ACCENT.fondo,
  },
  headerContainer: {
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 18,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
  },
  nuevoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  nuevoButtonText: {
    color: ACCENT.primario,
    fontSize: 13,
    fontWeight: "700",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statChipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  statChipValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "white",
  },
  statChipLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  filtroTitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filtrosContainer: {
    paddingBottom: 4,
  },
  filtroChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  filtroChipSeleccionado: {
    backgroundColor: "white",
    borderColor: "white",
  },
  filtroChipTexto: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  filtroChipTextoSeleccionado: {
    color: ACCENT.primario,
  },
  listaContainer: {
    padding: 14,
    gap: 12,
  },
  bloqueContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    overflow: "hidden",
  },
  bloqueHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  bloqueIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT.primarioFondo,
    alignItems: "center",
    justifyContent: "center",
  },
  bloqueHeaderText: {
    flex: 1,
  },
  bloqueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT.texto,
  },
  bloqueSubtitle: {
    fontSize: 11,
    color: ACCENT.textoSecundario,
    marginTop: 2,
  },
  chevronWrap: {
    marginLeft: 2,
  },
  preguntasContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: ACCENT.bordeSuave,
    paddingTop: 10,
    backgroundColor: ACCENT.fondo,
  },
  preguntaCard: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  idBadge: {
    backgroundColor: ACCENT.primario,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  idBadgeText: {
    fontSize: 11,
    color: "white",
    fontWeight: "700",
  },
  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT.primarioFondo,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tipoBadgeText: {
    fontSize: 10,
    color: ACCENT.primario,
    fontWeight: "700",
  },
  preguntaTexto: {
    fontSize: 13,
    fontWeight: "500",
    color: ACCENT.texto,
    marginTop: 8,
  },
  actionButton: {
    padding: 6,
  },
  emptyState: {
    marginTop: 80,
    alignItems: "center",
    gap: 6,
  },
  emptyStateIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: ACCENT.borde,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT.texto,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: ACCENT.textoSecundario,
  },

  // ── HEADER DEL MODAL (estilo escritorio) ──
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ACCENT.borde,
    gap: 10,
  },
  modalBackButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: ACCENT.primario,
  },
  modalSubtitle: {
    fontSize: 11,
    color: ACCENT.textoSecundario,
    marginTop: 2,
  },
  cancelButtonHeader: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  cancelButtonHeaderText: {
    color: ACCENT.textoSecundario,
    fontWeight: "700",
    fontSize: 13,
  },
  saveButtonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ACCENT.primario,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveButtonHeaderText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },

  // ── LAYOUT DE 3 COLUMNAS ──
  layoutEscritorio: {
    flex: 1,
    flexDirection: "row",
  },
  columnaIzquierda: {
    width: 240,
    flexShrink: 0,
    flexGrow: 0,
    borderRightWidth: 1,
    borderRightColor: ACCENT.borde,
    backgroundColor: "white",
  },
  columnaCentral: {
    flex: 2.2,
    borderRightWidth: 1,
    borderRightColor: ACCENT.borde,
  },
  columnaDerecha: {
    flex: 1.2,
    backgroundColor: ACCENT.fondo,
  },

  seccionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  seccionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    padding: 16,
    gap: 14,
    marginTop: -6,
  },
  seccionCardTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: ACCENT.texto,
  },
  campoGrupo: {
    gap: 6,
  },
  campoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT.primario,
  },
  campoLabelChico: {
    fontSize: 10,
    fontWeight: "800",
    color: ACCENT.textoTenue,
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
  },
  hintTexto: {
    fontSize: 10,
    fontStyle: "italic",
    color: ACCENT.textoTenue,
  },
  filaSeguridad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: ACCENT.borde,
  },
  filaSeguridadTitulo: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT.texto,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: ACCENT.fondo,
    color: ACCENT.texto,
  },
  calendarioOverlay: {
    flex: 1,
    backgroundColor: "rgba(16,24,40,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  calendarioCard: {
    width: 300,
    maxWidth: "100%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
  },
  calendarioHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarioHeaderTexto: {
    fontSize: 15,
    fontWeight: "700",
    color: ACCENT.texto,
  },
  calendarioFilaSemana: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calendarioDiaSemana: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: ACCENT.textoSecundario,
  },
  calendarioFila: {
    flexDirection: "row",
  },
  calendarioCelda: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarioCeldaTocable: {
    borderRadius: 999,
  },
  calendarioCeldaSeleccionada: {
    backgroundColor: ACCENT.primario,
  },
  calendarioCeldaTexto: {
    fontSize: 13,
    color: ACCENT.texto,
  },
  calendarioCeldaHoyTexto: {
    color: ACCENT.primario,
    fontWeight: "700",
  },
  calendarioCeldaSeleccionadaTexto: {
    color: "white",
    fontWeight: "700",
  },
  calendarioBotonCerrar: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  calendarioBotonCerrarTexto: {
    color: ACCENT.textoSecundario,
    fontWeight: "600",
    fontSize: 13,
  },
  calendarioBotonAbrir: {
    width: 42,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT.primarioFondo,
  },
  calendarioHoraFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ACCENT.bordeSuave,
  },
  calendarioHoraLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ACCENT.textoSecundario,
  },
  calendarioStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  calendarioStepperBoton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT.fondo,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarioStepperValor: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT.texto,
    minWidth: 44,
    textAlign: "center",
  },
  calendarioBotonAceptar: {
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: ACCENT.primario,
    borderRadius: 10,
  },
  calendarioBotonAceptarTexto: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  carreraChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: ACCENT.fondo,
    borderWidth: 1,
    borderColor: ACCENT.borde,
  },
  carreraChipActiva: {
    backgroundColor: ACCENT.primario,
    borderColor: ACCENT.primario,
  },
  carreraChipTexto: {
    fontSize: 12,
    color: ACCENT.texto,
    fontWeight: "600",
  },
  carreraChipTextoActiva: {
    color: "white",
  },

  // ── SELECTOR DE PREGUNTAS ──
  selectorWrap: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    padding: 12,
    gap: 10,
  },
  selectorWrapColumna: {
    flex: 1,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  selectorTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: ACCENT.texto,
  },
  contadorPreguntas: {
    backgroundColor: ACCENT.primario,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  contadorPreguntasTexto: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  selectorScrollHorizontal: {
    gap: 8,
    paddingHorizontal: 2,
  },
  selectorScrollVertical: {
    gap: 8,
  },
  selectorTab: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    backgroundColor: ACCENT.fondo,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  selectorTabHorizontal: {
    width: 128,
  },
  selectorTabActiva: {
    backgroundColor: ACCENT.primarioFondo,
    borderColor: ACCENT.primario,
    borderLeftWidth: 3,
  },
  selectorTabNumero: {
    fontSize: 11,
    fontWeight: "800",
    color: ACCENT.textoTenue,
  },
  selectorTabNumeroActivo: {
    color: ACCENT.primario,
  },
  selectorTabTexto: {
    fontSize: 11,
    color: ACCENT.textoSecundario,
    marginTop: 2,
  },
  selectorTabTextoActivo: {
    color: ACCENT.texto,
    fontWeight: "600",
  },
  selectorTabTextoVacio: {
    fontStyle: "italic",
    color: ACCENT.textoTenue,
  },
  selectorAgregar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCENT.primario,
    borderStyle: "dashed",
    backgroundColor: ACCENT.primarioFondo,
    paddingVertical: 12,
  },
  selectorAgregarHorizontal: {
    width: 100,
    flexDirection: "column",
  },
  selectorAgregarTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: ACCENT.primario,
  },

  // ── PANEL CONFIGURACIÓN ──
  configPanel: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    padding: 14,
  },
  configPanelTitulo: {
    fontSize: 12,
    fontWeight: "800",
    color: ACCENT.texto,
  },
  configFila: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  configLabel: {
    fontSize: 12,
    color: ACCENT.textoSecundario,
  },
  configValor: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT.texto,
  },

  // ── EDITOR DE PREGUNTA ──
  editorCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    padding: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: ACCENT.bordeSuave,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentedItemActivo: { backgroundColor: ACCENT.primario },
  segmentedItemTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ACCENT.texto,
  },
  segmentedItemTextoActivo: {
    color: "white",
    fontWeight: "700",
  },
  editorTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  editorBadge: {
    backgroundColor: ACCENT.primario,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editorBadgeTexto: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  botonOrden: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  tipoFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  tipoBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tipoBotonActivo: {
    borderWidth: 1.5,
    borderColor: ACCENT.primario,
    backgroundColor: ACCENT.primarioFondo,
  },
  tipoBotonActivoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT.primario,
  },
  tipoBotonDeshabilitado: {
    borderColor: ACCENT.borde,
    opacity: 0.5,
  },
  tipoBotonDeshabilitadoTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ACCENT.textoTenue,
  },
  tipoNota: {
    fontSize: 10,
    color: ACCENT.textoTenue,
    fontStyle: "italic",
    marginTop: 6,
  },
  opcionesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  enunciadoInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: ACCENT.fondo,
    color: ACCENT.texto,
    textAlignVertical: "top",
  },
  letraBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT.fondo,
    borderWidth: 1,
    borderColor: ACCENT.borde,
  },
  letraBadgeActiva: {
    backgroundColor: ACCENT.primario,
    borderColor: ACCENT.primario,
  },
  letraBadgeTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT.textoSecundario,
  },
  letraBadgeTextoActiva: {
    color: "white",
  },
  opcionInput: {
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 40,
    fontSize: 14,
    backgroundColor: "white",
    color: ACCENT.texto,
  },
  opcionInputActiva: {
    backgroundColor: ACCENT.primarioFondo,
    borderColor: ACCENT.primario,
  },
  checkBoton: {
    position: "absolute",
    right: 10,
  },
  agregarOpcionBoton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT.primario,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  agregarOpcionTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: ACCENT.primario,
  },
  obligatoriaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: ACCENT.bordeSuave,
  },
  toggleBase: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT.borde,
    padding: 3,
  },
  toggleBaseActivo: {
    backgroundColor: ACCENT.primario,
  },
  toggleBolita: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
  },
  toggleBolitaActiva: {
    marginLeft: 18,
  },
  puntajeInput: {
    width: 56,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: "center",
    color: ACCENT.texto,
  },

  conexionPunto: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  conexionTexto: {
    fontSize: 10,
    color: ACCENT.textoTenue,
  },

  // ── VISTA PREVIA ──
  previewWrap: {
    gap: 12,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  previewTitulo: {
    fontSize: 11,
    fontWeight: "800",
    color: ACCENT.textoSecundario,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fuenteSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fuenteSelectorTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT.texto,
  },
  fuenteOpciones: {
    position: "absolute",
    top: 36,
    left: 8,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    zIndex: 10,
    elevation: 6,
  },
  fuenteOpcion: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fuenteOpcionTexto: {
    fontSize: 12,
    color: ACCENT.texto,
  },
  alineacionGrupo: {
    flexDirection: "row",
    gap: 10,
  },
  alineacionBoton: {
    padding: 2,
  },
  previewDispositivoBoton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewDispositivoBotonActivo: {
    backgroundColor: ACCENT.primarioFondo,
  },
  previewCanvas: {
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  previewCanvasMovil: {
    width: 320,
    alignSelf: "center",
    borderRadius: 28,
    borderWidth: 6,
    borderColor: "#1f2937",
  },
  previewCanvasTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: ACCENT.fondo,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT.borde,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewCanvasTopTexto: {
    fontSize: 9,
    fontWeight: "800",
    color: ACCENT.textoTenue,
    letterSpacing: 0.6,
  },
  previewBody: {
    padding: 18,
    gap: 12,
  },
  previewBadgePregunta: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: ACCENT.primario,
    backgroundColor: ACCENT.primarioFondo,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  previewEnunciado: {
    fontWeight: "700",
    color: ACCENT.texto,
    lineHeight: 24,
  },
  previewSinOpciones: {
    fontSize: 12,
    color: ACCENT.textoTenue,
    fontStyle: "italic",
  },
  previewOpcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: ACCENT.borde,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewOpcionActiva: {
    borderWidth: 2,
    borderColor: ACCENT.primario,
    backgroundColor: ACCENT.primarioFondo,
  },
  previewOpcionLetra: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT.fondo,
  },
  previewOpcionLetraActiva: {
    backgroundColor: ACCENT.primario,
  },
  previewOpcionLetraTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT.textoSecundario,
  },
  previewOpcionLetraTextoActiva: {
    color: "white",
  },
  previewOpcionTexto: {
    flex: 1,
    color: ACCENT.textoSecundario,
  },
  previewOpcionTextoActivo: {
    color: ACCENT.texto,
    fontWeight: "600",
  },
  previewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ACCENT.borde,
    backgroundColor: ACCENT.fondo,
  },
  previewFooterBotonDeshabilitado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    opacity: 0.5,
  },
  previewFooterTextoDeshabilitado: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT.textoTenue,
  },
  previewFooterBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewFooterTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: ACCENT.primario,
  },
  tipCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: ACCENT.primario,
    borderRadius: 14,
    padding: 14,
  },
  tipCardTitulo: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
  },
  tipCardTexto: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    lineHeight: 16,
  },
  footerPaginacion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: ACCENT.borde,
  },
  footerPaginacionTexto: {
    fontSize: 11,
    color: ACCENT.textoSecundario,
  },
  footerPaginacionBotones: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paginacionBoton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: ACCENT.primarioFondo,
    alignItems: "center",
    justifyContent: "center",
  },
  paginacionBotonDeshabilitado: {
    backgroundColor: ACCENT.fondo,
  },
});