import { avisar } from "@/components/ConfirmDialog";
import { ColoresApp } from "@/constants/coloresApp";
import { registrarAspirante } from "@/services/aspirantesServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import { enviarCorreoConfirmacionRegistro } from "@/services/correoServicio";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Carga masiva de aspirantes a partir de una lista pegada por el
 * administrador. Migrado de `PantallaCargaMasivaAspirantes` en
 * pantalla_registro_aspirante.dart.
 *
 * Formato admitido por línea (separado por coma, tab o punto y coma):
 *   Nombre, correo@ejemplo.com
 *   Nombre, correo@ejemplo.com, Nombre exacto de la carrera
 */

type Carrera = { id: number; nombre: string };
type EstadoFila = "valida" | "error" | "creando" | "creada" | "fallida";

type FilaCarga = {
  numeroLinea: number;
  textoOriginal: string;
  nombre?: string;
  correo?: string;
  nombreCarreraTexto?: string;
  carreraId?: number;
  estado: EstadoFila;
  mensaje?: string;
  folioGenerado?: string;
};

function analizarLista(
  texto: string,
  carreras: Carrera[],
  carreraDefaultId: number | null,
): FilaCarga[] {
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const filas: FilaCarga[] = lineas.map((linea, i) => {
    const partes = linea
      .split(/[,\t;]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const fila: FilaCarga = {
      numeroLinea: i + 1,
      textoOriginal: linea,
      estado: "error",
    };

    if (partes.length < 2) {
      fila.mensaje = "Falta nombre o correo (usa: Nombre, correo)";
      return fila;
    }

    fila.nombre = partes[0];
    fila.correo = partes[1];
    if (partes.length >= 3) fila.nombreCarreraTexto = partes[2];

    if (fila.nombre.length < 3) {
      fila.mensaje = "Nombre demasiado corto";
      return fila;
    }
    if (!fila.correo.includes("@") || !fila.correo.includes(".")) {
      fila.mensaje = "Correo inválido";
      return fila;
    }

    if (fila.nombreCarreraTexto) {
      const match = carreras.find(
        (c) =>
          c.nombre.toLowerCase() === fila.nombreCarreraTexto!.toLowerCase(),
      );
      if (!match) {
        fila.mensaje = `Carrera "${fila.nombreCarreraTexto}" no existe`;
        return fila;
      }
      fila.carreraId = match.id;
    } else {
      fila.carreraId = carreraDefaultId ?? undefined;
    }

    if (fila.carreraId == null) {
      fila.mensaje = "Sin carrera asignada";
      return fila;
    }

    fila.estado = "valida";
    return fila;
  });

  // Marcar correos duplicados dentro de la misma lista
  const vistos = new Map<string, number>();
  for (const f of filas) {
    if (f.estado !== "valida" || !f.correo) continue;
    const key = f.correo.toLowerCase();
    if (vistos.has(key)) {
      f.estado = "error";
      f.mensaje = `Correo duplicado en la lista (línea ${vistos.get(key)})`;
    } else {
      vistos.set(key, f.numeroLinea);
    }
  }

  return filas;
}

const COLOR_ESTADO: Record<EstadoFila, string> = {
  valida: ColoresApp.primario,
  error: "#DC2626",
  creando: ColoresApp.advertencia,
  creada: ColoresApp.exito,
  fallida: "#DC2626",
};

const ICONO_ESTADO: Record<EstadoFila, keyof typeof Ionicons.glyphMap> = {
  valida: "time-outline",
  error: "close-circle-outline",
  creando: "sync-outline",
  creada: "checkmark-circle-outline",
  fallida: "alert-circle-outline",
};

export default function PantallaCargaMasivaAspirantes() {
  const router = useRouter();
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraDefaultId, setCarreraDefaultId] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState<FilaCarga[]>([]);
  const [enviarCorreos, setEnviarCorreos] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [indiceProcesando, setIndiceProcesando] = useState(-1);
  const [mensajeFinal, setMensajeFinal] = useState<{
    texto: string;
    exito: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const lista = (await obtenerCarreras()) as Carrera[];
      setCarreras(lista);
      if (lista.length > 0) setCarreraDefaultId(lista[0].id);
    })();
  }, []);

  const nombreCarreraDe = (id?: number) =>
    carreras.find((c) => c.id === id)?.nombre ?? "—";

  const totalValidas = useMemo(
    () => filas.filter((f) => f.estado === "valida").length,
    [filas],
  );
  const totalCreadas = useMemo(
    () => filas.filter((f) => f.estado === "creada").length,
    [filas],
  );
  const totalFallidas = useMemo(
    () => filas.filter((f) => f.estado === "fallida").length,
    [filas],
  );

  const analizar = () => {
    setMensajeFinal(null);
    setFilas(analizarLista(texto, carreras, carreraDefaultId));
  };

  const registrarTodos = async () => {
    if (totalValidas === 0) return;
    setProcesando(true);
    let creadas = 0;
    let fallidas = 0;
    const filasActuales = [...filas];

    for (let i = 0; i < filasActuales.length; i++) {
      const fila = filasActuales[i];
      if (fila.estado !== "valida") continue;

      setIndiceProcesando(i);
      fila.estado = "creando";
      setFilas([...filasActuales]);

      try {
        const resultado = await registrarAspirante({
          nombre: fila.nombre!,
          correo: fila.correo!,
          idCarrera: fila.carreraId!,
        });

        if (resultado) {
          fila.folioGenerado = resultado.folio?.toString();
          fila.estado = "creada";
          creadas++;

          if (enviarCorreos) {
            enviarCorreoConfirmacionRegistro({
              nombre: fila.nombre!,
              correo: fila.correo!,
              folio: fila.folioGenerado ?? "",
              carrera: nombreCarreraDe(fila.carreraId),
            }).catch((err) => {
              // Log completo para depuración.
              console.error(
                "Error detallado al enviar correo de confirmación:",
                JSON.stringify(err, null, 2),
              );
              // No bloquea el proceso, pero sí avisa al admin que este correo falló.
              avisar(
                "Aviso de correo",
                `No se pudo enviar el correo de bienvenida a ${fila.correo}.`,
              );
              return false;
            });
          }
        } else {
          fila.estado = "fallida";
          fila.mensaje = "Supabase rechazó el registro";
          fallidas++;
        }
      } catch (e: any) {
        fila.estado = "fallida";
        fila.mensaje = `Error: ${e.message ?? e}`;
        fallidas++;
      }

      setFilas([...filasActuales]);
      // Pequeña pausa para no saturar Supabase ni el edge function de correo.
      await new Promise((r) => setTimeout(r, 150));
    }

    setProcesando(false);
    setIndiceProcesando(-1);
    setMensajeFinal({
      texto: `${creadas} aspirantes registrados${fallidas > 0 ? ` · ${fallidas} fallaron` : ""}.`,
      exito: fallidas === 0,
    });
  };

  const copiarFolios = async () => {
    const texto = filas
      .filter((f) => f.estado === "creada")
      .map((f) => `${f.nombre} | ${f.correo} | Folio: ${f.folioGenerado}`)
      .join("\n");
    await Clipboard.setStringAsync(texto);
    setMensajeFinal({ texto: "Folios copiados al portapapeles", exito: true });
  };

  return (
    <SafeAreaView style={styles.contenedor}>
      <Stack.Screen options={{ title: "Carga masiva de aspirantes" }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={ColoresApp.texto} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Carga masiva de aspirantes</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={styles.etiqueta}>Pega la lista de aspirantes</Text>
        <Text style={styles.ayuda}>
          Una línea por aspirante: Nombre, correo@ejemplo.com{"\n"}
          Opcional: Nombre, correo@ejemplo.com, Nombre exacto de la carrera
        </Text>
        <TextInput
          style={styles.textarea}
          value={texto}
          onChangeText={setTexto}
          placeholder={
            "Juan Pérez, juan@correo.com\nAna López, ana@correo.com, Ingeniería en Software"
          }
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        {carreras.length > 0 && (
          <>
            <Text style={styles.etiqueta}>Carrera por defecto</Text>
            <Text style={styles.ayuda}>
              Se usa cuando la línea no especifica una carrera.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                {carreras.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCarreraDefaultId(c.id)}
                    style={[
                      styles.chipCarrera,
                      carreraDefaultId === c.id && styles.chipCarreraActiva,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipCarreraTexto,
                        carreraDefaultId === c.id && { color: "white" },
                      ]}
                    >
                      {c.nombre}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <View style={styles.filaSwitch}>
          <Text style={styles.etiquetaSwitch}>
            Enviar correo de confirmación a cada uno
          </Text>
          <Switch
            value={enviarCorreos}
            onValueChange={setEnviarCorreos}
            trackColor={{ true: ColoresApp.primario }}
          />
        </View>

        <Pressable
          style={styles.botonAnalizar}
          onPress={analizar}
          disabled={!texto.trim()}
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
              {(totalCreadas > 0 || totalFallidas > 0) && (
                <Text style={styles.resumenTexto}>
                  {totalCreadas} creadas · {totalFallidas} fallidas
                </Text>
              )}
            </View>

            {filas.map((f, i) => (
              <View
                key={f.numeroLinea}
                style={[
                  styles.filaCard,
                  indiceProcesando === i && styles.filaCardActiva,
                ]}
              >
                <Ionicons
                  name={ICONO_ESTADO[f.estado]}
                  size={20}
                  color={COLOR_ESTADO[f.estado]}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.filaTexto} numberOfLines={1}>
                    {f.nombre ? `${f.nombre} — ${f.correo}` : f.textoOriginal}
                  </Text>
                  {f.estado === "valida" && (
                    <Text style={styles.filaSubtexto}>
                      Carrera: {nombreCarreraDe(f.carreraId)}
                    </Text>
                  )}
                  {f.estado === "creada" && (
                    <Text
                      style={[styles.filaSubtexto, { color: ColoresApp.exito }]}
                    >
                      Folio: {f.folioGenerado}
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

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <Pressable
                style={[
                  styles.botonRegistrar,
                  (procesando || totalValidas === 0) && { opacity: 0.6 },
                ]}
                onPress={registrarTodos}
                disabled={procesando || totalValidas === 0}
              >
                {procesando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.botonRegistrarTexto}>
                    Registrar {totalValidas} aspirantes
                  </Text>
                )}
              </Pressable>
              {totalCreadas > 0 && (
                <Pressable style={styles.botonCopiar} onPress={copiarFolios}>
                  <Ionicons
                    name="copy-outline"
                    size={18}
                    color={ColoresApp.primario}
                  />
                </Pressable>
              )}
            </View>
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
    minHeight: 140,
    backgroundColor: "white",
    marginBottom: 20,
    color: ColoresApp.texto,
  },
  chipCarrera: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "white",
  },
  chipCarreraActiva: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
  },
  chipCarreraTexto: { fontSize: 13, color: ColoresApp.texto },
  filaSwitch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  etiquetaSwitch: {
    fontSize: 13,
    color: ColoresApp.texto,
    flex: 1,
    marginRight: 12,
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
  filaCardActiva: { borderColor: ColoresApp.advertencia, borderWidth: 1.5 },
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
    flex: 1,
    backgroundColor: ColoresApp.primario,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botonRegistrarTexto: { color: "white", fontWeight: "600", fontSize: 14 },
  botonCopiar: {
    width: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ColoresApp.primario,
    alignItems: "center",
    justifyContent: "center",
  },
});
