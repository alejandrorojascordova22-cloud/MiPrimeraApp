import { ColoresApp } from "@/constants/coloresApp";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { finalizarExamen, guardarRespuesta } from "@/services/examenServicio";
import { obtenerPreguntas } from "@/services/preguntasExamenesServicio";
import { obtenerSesionAspirante } from "@/services/sesionServicio";
import {
  calcularAciertos,
  calcularCalificacion,
} from "@/utils/examenControlador";

// --- TIPOS ---
type Pregunta = {
  id: number;
  pregunta: string;
  materia: string;
  tipo: "Opción múltiple" | "Abierta" | "Imagen" | "Audio";
  opcion_a?: string;
  opcion_b?: string;
  opcion_c?: string;
  opcion_d?: string;
  respuesta_correcta: string;
  es_obligatoria?: boolean;
  media_url?: string;
};

type Aspirante = {
  id: number;
  nombre: string;
  correo: string;
  folio: string;
  carreraId: number;
  carreraNombre: string;
};

// ========================================================================
// PANTALLA PRINCIPAL DEL EXAMEN
// ========================================================================

export default function PantallaExamen() {
  const router = useRouter();
  const { aspirante: aspiranteString } = useLocalSearchParams<{
    aspirante?: string;
  }>();

  const [aspirante, setAspirante] = useState<Aspirante | null>(
    aspiranteString ? (JSON.parse(aspiranteString) as Aspirante) : null,
  );
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<(string | null)[]>([]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [enviado, setEnviado] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(30 * 60);
  const [mostrarBadgeGuardado, setMostrarBadgeGuardado] = useState(false);
  const [enLinea, setEnLinea] = useState(() =>
    Platform.OS === "web" && typeof navigator !== "undefined"
      ? navigator.onLine
      : true,
  );
  const [haySincronizacionPendiente, setHaySincronizacionPendiente] =
    useState(false);

  const intentosSalida = useRef(0);
  const salioEn = useRef<number | null>(null);
  const enviarExamenRef = useRef<(porTiempo?: boolean) => void>(() => {});
  const claveAlumno = `examen_${aspirante?.folio ?? "sin_folio"}`;

  // --- Bloqueo de orientación y botón de retroceso ---
  useFocusEffect(
    useCallback(() => {
      const lockOrientation = async () => {
        try {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          );
        } catch (error) {
          // Algunos navegadores web no soportan bloqueo de orientación.
          console.warn("No se pudo bloquear la orientación:", error);
        }
      };
      lockOrientation();

      const onBackPress = () => {
        Alert.alert(
          "Acción no permitida",
          "No puedes retroceder durante el examen.",
        );
        return true; // Previene la acción de retroceso
      };
      const suscripcionBack = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => {
        suscripcionBack.remove();
        const unlockOrientation = async () => {
          try {
            await ScreenOrientation.unlockAsync();
          } catch (error) {
            console.warn("No se pudo desbloquear la orientación:", error);
          }
        };
        unlockOrientation();
      };
    }, []),
  );

  // --- Carga inicial del examen y restauración de progreso ---
  useEffect(() => {
    const cargarExamen = async () => {
      try {
        let aspiranteActual = aspirante;
        if (!aspiranteActual) {
          const sesion = await obtenerSesionAspirante();
          if (!sesion) {
            router.replace("/login");
            return;
          }
          aspiranteActual = {
            id: sesion.id,
            nombre: sesion.nombre,
            correo: sesion.correo,
            folio: sesion.folio,
            carreraId: sesion.carreraId,
            carreraNombre: sesion.carreraNombre,
          };
          setAspirante(aspiranteActual);
        }

        const clave = `examen_${aspiranteActual.folio}`;
        const listaPreguntas = (await obtenerPreguntas(
          aspiranteActual.carreraId,
        )) as Pregunta[];
        const respuestasGuardadas = await AsyncStorage.multiGet(
          listaPreguntas.map((_, i) => `${clave}_p${i}`),
        );
        const respuestasRestauradas = respuestasGuardadas.map(
          ([, value]) => value,
        );

        const [indiceGuardado, tiempoGuardado] = await AsyncStorage.multiGet([
          `${clave}_indice`,
          `${clave}_tiempo`,
        ]);

        setPreguntas(listaPreguntas);
        setRespuestas(respuestasRestauradas);
        if (indiceGuardado[1]) setIndiceActual(JSON.parse(indiceGuardado[1]));
        if (tiempoGuardado[1])
          setSegundosRestantes(JSON.parse(tiempoGuardado[1]));
      } catch {
        Alert.alert("Error", "No se pudieron cargar las preguntas del examen.");
      } finally {
        setCargando(false);
      }
    };
    cargarExamen();
    // Efecto de solo montaje: se ejecuta una vez al abrir la pantalla del
    // examen; `aspirante` y `router` se leen del cierre inicial a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Temporizador ---
  useEffect(() => {
    if (cargando || enviado) return;

    const timer = setInterval(() => {
      setSegundosRestantes((prev) => {
        const nuevoTiempo = prev - 1;
        if (nuevoTiempo <= 0) {
          clearInterval(timer);
          enviarExamenRef.current(true);
          return 0;
        }
        AsyncStorage.setItem(
          `${claveAlumno}_tiempo`,
          JSON.stringify(nuevoTiempo),
        );
        return nuevoTiempo;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cargando, enviado, claveAlumno]);

  // --- Detección de conexión a internet ---
  // Solo aplica en web (donde el navegador expone estos eventos). Sirve
  // para avisar al aspirante que sus respuestas se siguen guardando en el
  // dispositivo aunque se vaya el internet, y para reintentar el envío al
  // servidor cuando la conexión regrese.
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const alConectar = () => setEnLinea(true);
      const alDesconectar = () => setEnLinea(false);
      window.addEventListener("online", alConectar);
      window.addEventListener("offline", alDesconectar);
      return () => {
        window.removeEventListener("online", alConectar);
        window.removeEventListener("offline", alDesconectar);
      };
    }
  }, []);

  // --- Detección de cambio de estado de la app ---
  // Antes se contaba como "intento de salir" cualquier pérdida de foco,
  // incluso momentánea (por ejemplo, una notificación, cambiar de
  // pestaña un instante, o el navegador perdiendo el foco). Eso hacía que
  // el aviso apareciera todo el tiempo. Ahora solo cuenta si la app
  // permanece en segundo plano más de unos segundos, que es la señal real
  // de que el aspirante salió de la aplicación.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (enviado) return;

      if (nextAppState === "background" || nextAppState === "inactive") {
        salioEn.current = Date.now();
        return;
      }

      if (nextAppState === "active" && salioEn.current) {
        const segundosFuera = (Date.now() - salioEn.current) / 1000;
        salioEn.current = null;
        // Menos de 3 segundos: casi seguro fue un cambio de foco pasajero
        // (notificación, pantalla de bloqueo momentánea, etc.), no un
        // intento real de salir del examen.
        if (segundosFuera < 3) return;

        intentosSalida.current += 1;
        if (intentosSalida.current >= 2) {
          enviarExamenRef.current(true);
        } else {
          Alert.alert(
            "Advertencia de Seguridad",
            "Detectamos que saliste de la aplicación durante el examen. Si sales una vez más, tu examen se enviará automáticamente.",
          );
        }
      }
    });

    return () => subscription.remove();
  }, [enviado]);

  const claveePendientes = `${claveAlumno}_pendientes`;

  const sincronizarPendientes = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(claveePendientes);
      const pendientes: number[] = json ? JSON.parse(json) : [];
      if (pendientes.length === 0) {
        setHaySincronizacionPendiente(false);
        return;
      }
      const siguenPendientes: number[] = [];
      for (const idx of pendientes) {
        const respuestaGuardada = await AsyncStorage.getItem(
          `${claveAlumno}_p${idx}`,
        );
        if (!respuestaGuardada || !preguntas[idx]) continue;
        try {
          await guardarRespuesta({
            idAspirante: aspirante!.id,
            idPregunta: preguntas[idx].id,
            respuesta: respuestaGuardada,
          });
        } catch {
          siguenPendientes.push(idx);
        }
      }
      await AsyncStorage.setItem(
        claveePendientes,
        JSON.stringify(siguenPendientes),
      );
      setHaySincronizacionPendiente(siguenPendientes.length > 0);
    } catch {
      // Si ni siquiera se pudo leer el respaldo local, se reintentará en
      // la próxima reconexión.
    }
  }, [claveAlumno, claveePendientes, preguntas, aspirante]);

  // En cuanto vuelve la conexión, intenta reenviar las respuestas que se
  // quedaron guardadas solo en el dispositivo. Se agenda con setTimeout
  // para que la sincronización (y sus setState) ocurra fuera del cuerpo
  // síncrono del efecto.
  useEffect(() => {
    if (!enLinea) return;
    const id = setTimeout(() => {
      sincronizarPendientes();
    }, 0);
    return () => clearTimeout(id);
  }, [enLinea, sincronizarPendientes]);

  const seleccionarOpcion = async (opcionElegida: string) => {
    if (!aspirante) return;
    const nuevasRespuestas = [...respuestas];
    nuevasRespuestas[indiceActual] = opcionElegida;
    setRespuestas(nuevasRespuestas);
    setMostrarBadgeGuardado(true);

    // Se guarda primero en el dispositivo: esto nunca falla por falta de
    // internet, así que la respuesta del aspirante no se pierde aunque se
    // vaya la conexión o se apague el dispositivo antes de sincronizar.
    await AsyncStorage.setItem(
      `${claveAlumno}_p${indiceActual}`,
      opcionElegida,
    );
    try {
      await guardarRespuesta({
        idAspirante: aspirante.id,
        idPregunta: preguntas[indiceActual].id,
        respuesta: opcionElegida,
      });
    } catch {
      // Sin conexión (u otro error de red): se marca como pendiente para
      // reintentar automáticamente en cuanto vuelva el internet.
      const json = await AsyncStorage.getItem(claveePendientes);
      const pendientes: number[] = json ? JSON.parse(json) : [];
      if (!pendientes.includes(indiceActual)) {
        pendientes.push(indiceActual);
        await AsyncStorage.setItem(
          claveePendientes,
          JSON.stringify(pendientes),
        );
      }
      setHaySincronizacionPendiente(true);
    }

    setTimeout(() => setMostrarBadgeGuardado(false), 2000);
  };

  const irAPregunta = async (nuevoIndice: number) => {
    if (nuevoIndice < 0 || nuevoIndice >= preguntas.length) return;
    setIndiceActual(nuevoIndice);
    await AsyncStorage.setItem(
      `${claveAlumno}_indice`,
      JSON.stringify(nuevoIndice),
    );
  };

  const enviarExamen = useCallback(
    async (porTiempo = false) => {
      if (enviado || !aspirante) return;

      const confirmarEnvio = async () => {
        setEnviado(true);
        const aciertos = calcularAciertos(preguntas, respuestas);
        const calificacion = calcularCalificacion(aciertos, preguntas.length);
        const estadoFinal = "terminado";

        try {
          await finalizarExamen({
            idAspirante: aspirante.id,
            aciertos,
            total: preguntas.length,
            calificacion,
            estado: estadoFinal,
          });

          // Limpiar AsyncStorage
          const keys = preguntas.map((_, i) => `${claveAlumno}_p${i}`);
          keys.push(`${claveAlumno}_indice`, `${claveAlumno}_tiempo`, claveePendientes);
          await AsyncStorage.multiRemove(keys);

          // Navegar a resultados
          const fechaEnvioISO = new Date().toISOString();
          const fechaInicioISO = new Date(
            Date.now() - (30 * 60 - segundosRestantes) * 1000,
          ).toISOString();

          router.replace({
            pathname: "/resultado",
            params: {
              aciertos,
              total: preguntas.length,
              calificacion,
              estado: estadoFinal,
              fechaEnvio: fechaEnvioISO,
              fechaInicio: fechaInicioISO,
              fechaFin: fechaEnvioISO,
            },
          });
        } catch {
          Alert.alert(
            "Error",
            "No se pudo enviar el examen. Intenta de nuevo.",
          );
          setEnviado(false);
        }
      };

      if (porTiempo) {
        Alert.alert("Tiempo agotado", "Tu examen se enviará automáticamente.");
        confirmarEnvio();
      } else {
        const mensaje = `Has respondido ${respuestas.filter(Boolean).length} de ${preguntas.length} preguntas. Una vez enviado no podrás regresar.`;
        if (Platform.OS === "web") {
          const confirmar = window.confirm(`¿Enviar examen?\n\n${mensaje}`);
          if (confirmar) {
            confirmarEnvio();
          }
        } else {
          Alert.alert("¿Enviar examen?", mensaje, [
            { text: "Revisar", style: "cancel" },
            { text: "Enviar", onPress: confirmarEnvio, style: "destructive" },
          ]);
        }
      }
    },
    [
      enviado,
      aspirante,
      preguntas,
      respuestas,
      claveAlumno,
      claveePendientes,
      router,
      segundosRestantes,
    ],
  );

  useEffect(() => {
    enviarExamenRef.current = enviarExamen;
  }, [enviarExamen]);

  if (cargando) {
    return <CargandoExamen />;
  }

  if (!aspirante || preguntas.length === 0) {
    return <ErrorCargaPreguntas />;
  }

  const pregunta = preguntas[indiceActual];
  const totalRespondidas = respuestas.filter(Boolean).length;
  const tiempoFormateado = `${Math.floor(segundosRestantes / 60)
    .toString()
    .padStart(2, "0")}:${(segundosRestantes % 60).toString().padStart(2, "0")}`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderExamen
        carreraNombre={aspirante.carreraNombre}
        tiempoFormateado={tiempoFormateado}
        tiempoEnRojo={segundosRestantes <= 300}
        progreso={(indiceActual + 1) / preguntas.length}
        indiceActual={indiceActual}
        totalPreguntas={preguntas.length}
        totalRespondidas={totalRespondidas}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.preguntaContainer}>
          <View style={styles.badgesContainer}>
            <Badge color={ColoresApp.primario} textColor="white">
              Pregunta {indiceActual + 1}
            </Badge>
            {!!pregunta.materia && (
              <Badge color="#DBE1FF" textColor="#111A37">
                {pregunta.materia.toUpperCase()}
              </Badge>
            )}
          </View>

          <Text style={styles.preguntaTexto}>{pregunta.pregunta}</Text>
          {/* The extra space was here */}

          {!!pregunta.opcion_a && (
            <OpcionRespuesta
              letra="A"
              texto={pregunta.opcion_a}
              seleccionada={respuestas[indiceActual] === "A"}
              onPress={() => seleccionarOpcion("A")}
            />
          )}
          {!!pregunta.opcion_b && (
            <OpcionRespuesta
              letra="B"
              texto={pregunta.opcion_b}
              seleccionada={respuestas[indiceActual] === "B"}
              onPress={() => seleccionarOpcion("B")}
            />
          )}
          {!!pregunta.opcion_c && (
            <OpcionRespuesta
              letra="C"
              texto={pregunta.opcion_c}
              seleccionada={respuestas[indiceActual] === "C"}
              onPress={() => seleccionarOpcion("C")}
            />
          )}
          {!!pregunta.opcion_d && (
            <OpcionRespuesta
              letra="D"
              texto={pregunta.opcion_d}
              seleccionada={respuestas[indiceActual] === "D"}
              onPress={() => seleccionarOpcion("D")}
            />
          )}

          {mostrarBadgeGuardado && (
            <View style={styles.guardadoBadge}>
              <Ionicons
                name={enLinea ? "checkmark-circle" : "cloud-offline-outline"}
                color={enLinea ? "green" : "#B8860B"}
                size={14}
              />
              <Text style={styles.guardadoTexto}>
                {enLinea ? "Respuesta guardada" : "Guardada en el dispositivo"}
              </Text>
            </View>
          )}

          {(!enLinea || haySincronizacionPendiente) && (
            <View style={styles.conexionBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#B8860B" />
              <Text style={styles.conexionBannerTexto}>
                {!enLinea
                  ? "Sin conexión a internet: tus respuestas se están guardando en este dispositivo y se enviarán en cuanto vuelva la conexión."
                  : "Sincronizando respuestas guardadas mientras no había conexión..."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PuntosNavegacion
          total={preguntas.length}
          actual={indiceActual}
          respuestas={respuestas}
          onPress={irAPregunta}
        />
        <SizedBox height={12} />
        <BotonesNavegacion
          esPrimera={indiceActual === 0}
          esUltima={indiceActual === preguntas.length - 1}
          onAnterior={() => irAPregunta(indiceActual - 1)}
          onSiguiente={() => irAPregunta(indiceActual + 1)}
          onEnviar={() => enviarExamen(false)}
        />
      </View>
    </View>
  );
}

// --- SUB-COMPONENTES DE LA PANTALLA ---

const SizedBox = ({ height }: { height: number }) => (
  <View style={{ height }} />
);

const CargandoExamen = () => (
  <View style={styles.centered}>
    <ActivityIndicator size="large" color={ColoresApp.primario} />
    <Text style={styles.cargandoTexto}>Preparando tu examen...</Text>
  </View>
);

const ErrorCargaPreguntas = () => {
  const router = useRouter();
  return (
    <View style={styles.centered}>
      <Ionicons name="warning-outline" size={40} color="red" />
      <Text style={styles.errorTexto}>No se pudieron cargar las preguntas</Text>
      <Text style={{ color: "grey" }}>Avisa al personal de Vinculación.</Text>
      <Pressable
        style={[styles.boton, { marginTop: 20 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.botonTexto}>Regresar</Text>
      </Pressable>
    </View>
  );
};

const HeaderExamen = ({
  carreraNombre,
  tiempoFormateado,
  tiempoEnRojo,
  progreso,
  indiceActual,
  totalPreguntas,
  totalRespondidas,
}: any) => (
  <LinearGradient colors={["#040D2A", "#0B2A55"]} style={styles.header}>
    <SafeAreaView>
      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <View style={styles.carreraBadge}>
            <Ionicons
              name="school-outline"
              color="rgba(255,255,255,0.6)"
              size={12}
            />
            <Text style={styles.carreraTexto} numberOfLines={1}>
              {carreraNombre}
            </Text>
          </View>
          <View
            style={[styles.timerBadge, tiempoEnRojo && styles.timerBadgeRojo]}
          >
            <Ionicons
              name={tiempoEnRojo ? "timer-outline" : "time-outline"}
              color={tiempoEnRojo ? "red" : "white"}
              size={14}
            />
            <Text style={[styles.timerTexto, tiempoEnRojo && { color: "red" }]}>
              {tiempoFormateado}
            </Text>
          </View>
        </View>
        <SizedBox height={14} />
        <View style={styles.progressBarBackground}>
          <View
            style={[styles.progressBarFill, { width: `${progreso * 100}%` }]}
          />
        </View>
        <SizedBox height={7} />
        <View style={styles.progressTextContainer}>
          <Text
            style={styles.progressTexto}
          >{`Pregunta ${indiceActual + 1} de ${totalPreguntas}`}</Text>
          <Text
            style={styles.progressTexto}
          >{`${totalRespondidas} respondidas`}</Text>
        </View>
      </View>
    </SafeAreaView>
  </LinearGradient>
);

const Badge = ({
  children,
  color,
  textColor,
}: {
  children: React.ReactNode;
  color: string;
  textColor: string;
}) => (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={[styles.badgeTexto, { color: textColor }]}>{children}</Text>
  </View>
);

const OpcionRespuesta = ({ letra, texto, seleccionada, onPress }: any) => (
  <Pressable onPress={onPress}>
    <View
      style={[
        styles.opcionContainer,
        seleccionada && styles.opcionSeleccionada,
      ]}
    >
      <View
        style={[
          styles.opcionLetraContainer,
          seleccionada && { backgroundColor: ColoresApp.primario },
        ]}
      >
        {seleccionada ? (
          <Ionicons name="checkmark" size={15} color="white" />
        ) : (
          <Text style={styles.opcionLetraTexto}>{letra}</Text>
        )}
      </View>
      <Text
        style={[
          styles.opcionTexto,
          seleccionada && styles.opcionTextoSeleccionado,
        ]}
      >
        {texto}
      </Text>
    </View>
  </Pressable>
);

const PuntosNavegacion = ({ total, actual, respuestas, onPress }: any) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ alignItems: "center" }}
  >
    {Array.from({ length: total }).map((_, i) => {
      const esActual = i === actual;
      const respondida = !!respuestas[i];
      let color = "#D1D5DB"; // gris
      if (respondida) color = "#4ADE80"; // verde
      if (esActual) color = ColoresApp.primario;

      return (
        <Pressable key={i} onPress={() => onPress(i)}>
          <View
            style={[
              styles.puntoNav,
              { backgroundColor: color, width: esActual ? 20 : 7 },
            ]}
          />
        </Pressable>
      );
    })}
  </ScrollView>
);

const BotonesNavegacion = ({
  esPrimera,
  esUltima,
  onAnterior,
  onSiguiente,
  onEnviar,
}: any) => (
  <View style={styles.botonesNavContainer}>
    <Pressable
      disabled={esPrimera}
      style={[styles.botonNav, esPrimera && styles.botonNavDisabled]}
      onPress={onAnterior}
    >
      <Ionicons
        name="arrow-back"
        size={16}
        color={esPrimera ? "#9CA3AF" : "#4B5563"}
      />
      <Text style={[styles.botonNavTexto, esPrimera && { color: "#9CA3AF" }]}>
        Anterior
      </Text>
    </Pressable>
    <Pressable
      style={[
        styles.botonNav,
        styles.botonNavSiguiente,
        esUltima && styles.botonNavEnviar,
      ]}
      onPress={esUltima ? onEnviar : onSiguiente}
    >
      <Text style={styles.botonNavTextoPrincipal}>
        {esUltima ? "Enviar examen" : "Siguiente"}
      </Text>
      <Ionicons
        name={esUltima ? "send" : "arrow-forward"}
        size={16}
        color="white"
      />
    </Pressable>
  </View>
);

// --- ESTILOS ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  cargandoTexto: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#45464D",
  },
  errorTexto: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0B1C30",
    textAlign: "center",
    marginTop: 16,
  },
  boton: {
    backgroundColor: ColoresApp.primario,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  botonTexto: { color: "white", fontWeight: "bold" },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    boxShadow: "0 4px 8px #0000001A",
  },
  headerContent: { padding: 16, paddingTop: 0 },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carreraBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  carreraTexto: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 5,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timerBadgeRojo: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  timerTexto: {
    color: "white",
    fontSize: 13,
    fontWeight: "bold",
    marginLeft: 5,
  },
  progressBarBackground: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#4ADE80" },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  progressTexto: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "500",
  },
  scrollContainer: { padding: 16, alignItems: "center" },
  preguntaContainer: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    boxShadow: "0 2px 12px #0000000A",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  badgeTexto: { fontSize: 10, fontWeight: "bold" },
  preguntaTexto: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    color: "#0B1C30",
    marginTop: 14,
    marginBottom: 18,
  },
  opcionContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "white",
  },
  opcionSeleccionada: {
    borderColor: ColoresApp.primario,
    borderWidth: 1.5,
    backgroundColor: "#E6F1FB",
    boxShadow: `0 2px 8px ${ColoresApp.primario}1A`,
  },
  opcionLetraContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  opcionLetraTexto: { fontSize: 11, fontWeight: "600", color: "grey" },
  opcionTexto: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#3C3C43",
  },
  opcionTextoSeleccionado: { color: "#0B1C30", fontWeight: "600" },
  guardadoBadge: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  guardadoTexto: {
    color: "green",
    fontSize: 11,
    fontWeight: "500",
    marginLeft: 4,
  },
  conexionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF7E0",
    borderWidth: 1,
    borderColor: "#F0D590",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  conexionBannerTexto: {
    flex: 1,
    fontSize: 11,
    color: "#7A5B00",
  },
  footer: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  puntoNav: { height: 7, borderRadius: 4, marginHorizontal: 3 },
  botonesNavContainer: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    maxWidth: 760,
  },
  botonNav: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C6C6CE",
    gap: 6,
  },
  botonNavDisabled: { opacity: 0.5 },
  botonNavTexto: { color: "#4B5563", fontWeight: "bold" },
  botonNavSiguiente: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
  },
  botonNavEnviar: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  botonNavTextoPrincipal: { color: "white", fontWeight: "bold" },
});