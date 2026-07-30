import { ColoresApp } from "@/constants/coloresApp";
import {
  agregarPreguntasBloque,
  crearExamen,
  obtenerExamenes,
} from "@/services/preguntasExamenesServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Carga masiva de preguntas de opción múltiple para un examen existente.
 * Mismo patrón que carga-masiva.tsx (aspirantes): el admin pega una lista
 * de texto, se analiza línea por línea con preview de errores, y solo se
 * insertan las filas válidas al dar "Registrar".
 *
 * Formato admitido por línea (separado por | ):
 *   Pregunta | Opción A | Opción B | Opción C | Opción D | Letra correcta
 *
 * Ejemplo:
 *   ¿Cuál es la capital de México? | CDMX | Guadalajara | Monterrey | Puebla | A
 *
 * Se requiere mínimo 2 opciones (A y B); C y D son opcionales dejando el
 * campo vacío entre las barras: Pregunta | Opción A | Opción B | | | A
 */

type Examen = { id: number; materia: string; seccion?: string };
type EstadoFila = "valida" | "error" | "creada" | "fallida";

type FilaPregunta = {
  numeroLinea: number;
  textoOriginal: string;
  pregunta?: string;
  opcion_a?: string;
  opcion_b?: string;
  opcion_c?: string;
  opcion_d?: string;
  respuesta_correcta?: string;
  estado: EstadoFila;
  mensaje?: string;
};

function analizarListaPreguntas(texto: string): FilaPregunta[] {
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lineas.map((linea, i) => {
    const partes = linea.split("|").map((p) => p.trim());

    const fila: FilaPregunta = {
      numeroLinea: i + 1,
      textoOriginal: linea,
      estado: "error",
    };

    if (partes.length < 6) {
      fila.mensaje =
        "Formato incompleto (usa: Pregunta | OpciónA | OpciónB | OpciónC | OpciónD | Correcta)";
      return fila;
    }

    const [pregunta, opcionA, opcionB, opcionC, opcionD, correctaRaw] = partes;

    if (!pregunta || pregunta.length < 3) {
      fila.mensaje = "Texto de pregunta demasiado corto o vacío";
      return fila;
    }
    if (!opcionA || !opcionB) {
      fila.mensaje = "Faltan la opción A o B (son obligatorias)";
      return fila;
    }

    const correcta = correctaRaw.toUpperCase();
    const opcionesDisponibles: Record<string, string | undefined> = {
      A: opcionA,
      B: opcionB,
      C: opcionC || undefined,
      D: opcionD || undefined,
    };

    if (!["A", "B", "C", "D"].includes(correcta)) {
      fila.mensaje = "La respuesta correcta debe ser A, B, C o D";
      return fila;
    }
    if (!opcionesDisponibles[correcta]) {
      fila.mensaje = `La opción ${correcta} marcada como correcta está vacía`;
      return fila;
    }

    fila.pregunta = pregunta;
    fila.opcion_a = opcionA;
    fila.opcion_b = opcionB;
    fila.opcion_c = opcionC || undefined;
    fila.opcion_d = opcionD || undefined;
    fila.respuesta_correcta = correcta;
    fila.estado = "valida";
    return fila;
  });
}

const COLOR_ESTADO: Record<EstadoFila, string> = {
  valida: ColoresApp.primario,
  error: "#DC2626",
  creada: ColoresApp.exito,
  fallida: "#DC2626",
};

const ICONO_ESTADO: Record<EstadoFila, keyof typeof Ionicons.glyphMap> = {
  valida: "time-outline",
  error: "close-circle-outline",
  creada: "checkmark-circle-outline",
  fallida: "alert-circle-outline",
};

type ModoExamen = "existente" | "nuevo";

export default function PantallaCargaMasivaPreguntas() {
  const router = useRouter();
  const [modo, setModo] = useState<ModoExamen>("existente");

  // Modo "examen existente"
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [examenSeleccionadoId, setExamenSeleccionadoId] = useState<
    number | null
  >(null);

  // Modo "examen nuevo"
  const [nuevaMateria, setNuevaMateria] = useState("");
  const [nuevaSeccion, setNuevaSeccion] = useState("");
  const [nuevaDuracion, setNuevaDuracion] = useState("60");
  const [creandoExamen, setCreandoExamen] = useState(false);

  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<FilaPregunta[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFinal, setMensajeFinal] = useState<{
    texto: string;
    exito: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const lista = (await obtenerExamenes()) as Examen[];
      setExamenes(lista);
      if (lista.length > 0) setExamenSeleccionadoId(lista[0].id);
    })();
  }, []);

  const totalValidas = useMemo(
    () => filas.filter((f) => f.estado === "valida").length,
    [filas],
  );
  const totalCreadas = useMemo(
    () => filas.filter((f) => f.estado === "creada").length,
    [filas],
  );

  const analizar = () => {
    setMensajeFinal(null);
    setFilas(analizarListaPreguntas(texto));
  };

  const registrarTodas = async () => {
    if (totalValidas === 0) return;

    let idExamenDestino: number | null = examenSeleccionadoId;

    if (modo === "nuevo") {
      if (!nuevaMateria.trim() || !nuevaSeccion.trim()) {
        setMensajeFinal({
          texto: "Completa materia y sección para crear el examen.",
          exito: false,
        });
        return;
      }
      setCreandoExamen(true);
      const examenCreado = await crearExamen({
        materia: nuevaMateria.trim(),
        seccion: nuevaSeccion.trim(),
        duracion_examen: parseInt(nuevaDuracion, 10) || 60,
      });
      setCreandoExamen(false);

      if (!examenCreado) {
        setMensajeFinal({
          texto: "No se pudo crear el examen nuevo. Revisa la consola.",
          exito: false,
        });
        return;
      }
      idExamenDestino = examenCreado.id;
    }

    if (idExamenDestino == null) return;

    setProcesando(true);

    const filasActuales = [...filas];
    const validas = filasActuales.filter((f) => f.estado === "valida");

    const payload = validas.map((f) => ({
      examen_id: idExamenDestino,
      pregunta: f.pregunta,
      tipo: "Opción múltiple",
      opcion_a: f.opcion_a,
      opcion_b: f.opcion_b,
      opcion_c: f.opcion_c,
      opcion_d: f.opcion_d,
      respuesta_correcta: f.respuesta_correcta,
    }));

    const ok = await agregarPreguntasBloque(payload);

    for (const f of filasActuales) {
      if (f.estado !== "valida") continue;
      f.estado = ok ? "creada" : "fallida";
      if (!ok) f.mensaje = "Supabase rechazó la inserción en lote";
    }
    setFilas([...filasActuales]);

    setProcesando(false);
    setMensajeFinal({
      texto: ok
        ? `${validas.length} preguntas agregadas al examen.`
        : "No se pudieron guardar las preguntas. Revisa la consola.",
      exito: ok,
    });
  };

  return (
    <SafeAreaView style={styles.contenedor}>
      <Stack.Screen options={{ title: "Carga masiva de preguntas" }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Carga masiva de preguntas</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.etiqueta}>EXAMEN DESTINO</Text>
        <View style={styles.selectorModo}>
          <Pressable
            style={[
              styles.botonModo,
              modo === "existente" && styles.botonModoActivo,
            ]}
            onPress={() => setModo("existente")}
          >
            <Text
              style={[
                styles.botonModoTexto,
                modo === "existente" && { color: "white" },
              ]}
            >
              Examen existente
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.botonModo,
              modo === "nuevo" && styles.botonModoActivo,
            ]}
            onPress={() => setModo("nuevo")}
          >
            <Text
              style={[
                styles.botonModoTexto,
                modo === "nuevo" && { color: "white" },
              ]}
            >
              Examen nuevo
            </Text>
          </Pressable>
        </View>

        {modo === "existente" ? (
          <>
            <Text style={styles.ayuda}>
              Todas las preguntas de esta carga se agregarán a este examen.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                {examenes.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => setExamenSeleccionadoId(e.id)}
                    style={[
                      styles.chipExamen,
                      examenSeleccionadoId === e.id && styles.chipExamenActivo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipExamenTexto,
                        examenSeleccionadoId === e.id && { color: "white" },
                      ]}
                    >
                      {e.materia}
                      {e.seccion ? ` · ${e.seccion}` : ""}
                    </Text>
                  </Pressable>
                ))}
                {examenes.length === 0 && (
                  <Text style={styles.ayuda}>
                    No hay exámenes existentes todavía. Usa &quot;Examen nuevo&quot;.
                  </Text>
                )}
              </View>
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.ayuda}>
              Se creará un examen nuevo con estos datos, y las preguntas se
              agregarán ahí. Podrás vincular carreras después desde el editor
              normal.
            </Text>
            <Text style={styles.etiquetaCampo}>Materia</Text>
            <TextInput
              style={styles.inputCorto}
              value={nuevaMateria}
              onChangeText={setNuevaMateria}
              placeholder="Ej. Programación"
              placeholderTextColor={ColoresApp.textoSecundario}
            />
            <Text style={styles.etiquetaCampo}>Sección</Text>
            <TextInput
              style={styles.inputCorto}
              value={nuevaSeccion}
              onChangeText={setNuevaSeccion}
              placeholder="Ej. Fundamentos"
              placeholderTextColor={ColoresApp.textoSecundario}
            />
            <Text style={styles.etiquetaCampo}>Duración (minutos)</Text>
            <TextInput
              style={styles.inputCorto}
              value={nuevaDuracion}
              onChangeText={setNuevaDuracion}
              placeholder="60"
              placeholderTextColor={ColoresApp.textoSecundario}
              keyboardType="numeric"
            />
            <View style={{ marginBottom: 10 }} />
          </>
        )}

        <Text style={styles.etiqueta}>LISTA DE PREGUNTAS</Text>
        <Text style={styles.ayuda}>
          Una pregunta por línea, separando los campos con &quot;|&quot;:{"\n"}
          Pregunta | Opción A | Opción B | Opción C | Opción D | Correcta
          (A/B/C/D)
        </Text>
        <TextInput
          style={styles.textarea}
          value={texto}
          onChangeText={setTexto}
          placeholder={
            "¿Cuál es la capital de México? | CDMX | Guadalajara | Monterrey | Puebla | A"
          }
          placeholderTextColor={ColoresApp.textoSecundario}
          multiline
        />

        <Pressable
          style={styles.botonAnalizar}
          onPress={analizar}
          disabled={
            !texto.trim() ||
            (modo === "existente" && examenSeleccionadoId == null)
          }
        >
          <Ionicons name="scan-outline" size={18} color="white" />
          <Text style={styles.botonAnalizarTexto}>Analizar lista</Text>
        </Pressable>

        {filas.length > 0 && (
          <>
            <View style={styles.resumenFilas}>
              <Text style={styles.resumenTexto}>
                {filas.length} líneas · {totalValidas} válidas
              </Text>
              {totalCreadas > 0 && (
                <Text style={styles.resumenTexto}>
                  {totalCreadas} creadas
                </Text>
              )}
            </View>

            {filas.map((f) => (
              <View key={f.numeroLinea} style={styles.filaCard}>
                <Ionicons
                  name={ICONO_ESTADO[f.estado]}
                  size={20}
                  color={COLOR_ESTADO[f.estado]}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.filaTexto} numberOfLines={2}>
                    {f.pregunta ?? f.textoOriginal}
                  </Text>
                  {f.estado === "valida" && (
                    <Text style={styles.filaSubtexto}>
                      Correcta: {f.respuesta_correcta}
                    </Text>
                  )}
                  {(f.estado === "error" || f.estado === "fallida") &&
                    f.mensaje && (
                      <Text style={[styles.filaSubtexto, { color: "#DC2626" }]}>
                        {f.mensaje}
                      </Text>
                    )}
                </View>
              </View>
            ))}

            {mensajeFinal && (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: mensajeFinal.exito
                      ? ColoresApp.exitoFondo
                      : "#FBEFDD",
                  },
                ]}
              >
                <Text
                  style={{
                    color: mensajeFinal.exito
                      ? ColoresApp.exito
                      : ColoresApp.advertencia,
                  }}
                >
                  {mensajeFinal.texto}
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.botonRegistrar,
                (procesando || creandoExamen || totalValidas === 0) && {
                  opacity: 0.6,
                },
              ]}
              onPress={registrarTodas}
              disabled={procesando || creandoExamen || totalValidas === 0}
            >
              {procesando || creandoExamen ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.botonRegistrarTexto}>
                  {modo === "nuevo"
                    ? `Crear examen y agregar ${totalValidas} preguntas`
                    : `Agregar ${totalValidas} preguntas`}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: ColoresApp.fondo },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  topBarTitulo: { fontSize: 15, fontWeight: "600", color: ColoresApp.oscuro },
  contenido: { padding: 20, maxWidth: 640, width: "100%", alignSelf: "center" },
  etiqueta: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.primario,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  ayuda: { fontSize: 12, color: ColoresApp.textoSecundario, marginBottom: 10 },
  textarea: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 160,
    backgroundColor: "white",
    marginBottom: 20,
    color: ColoresApp.texto,
  },
  chipExamen: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "white",
  },
  chipExamenActivo: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
  },
  chipExamenTexto: { fontSize: 13, color: ColoresApp.texto },
  selectorModo: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 4,
    marginBottom: 14,
  },
  botonModo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  botonModoActivo: { backgroundColor: ColoresApp.primario },
  botonModoTexto: { fontSize: 13, fontWeight: "600", color: ColoresApp.texto },
  etiquetaCampo: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
    marginBottom: 4,
    marginTop: 10,
  },
  inputCorto: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    backgroundColor: "white",
    color: ColoresApp.texto,
  },
  botonAnalizar: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ColoresApp.primario,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  botonAnalizarTexto: { color: "white", fontWeight: "600", fontSize: 14 },
  resumenFilas: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  resumenTexto: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    fontWeight: "600",
  },
  filaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 12,
    marginBottom: 8,
  },
  filaTexto: { fontSize: 13, fontWeight: "600", color: ColoresApp.texto },
  filaSubtexto: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  banner: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    alignItems: "center",
  },
  botonRegistrar: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  botonRegistrarTexto: { color: "white", fontWeight: "600", fontSize: 14 },
});