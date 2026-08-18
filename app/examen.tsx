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
import * as ScreenCapture from "expo-screen-capture";
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
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { obtenerAspirantePorId } from "@/services/aspirantesServicio";
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
  modo_calificacion?: "inmediato" | "programado";
  fecha_publicacion?: string | null;
  bloqueo_capturas?: boolean;
  bloqueo_navegacion?: boolean;
};

type Aspirante = {
  id: number;
  nombre: string;
  correo: string;
  folio: string;
  carreraId: number;
  carreraNombre: string;
};

// Ancho a partir del cual consideramos que estamos en tablet/computadora y
// le damos más aire al contenido (en vez de dejarlo apretado en una columna
// angosta como en celular).
const BP_ESCRITORIO = 900;

// ========================================================================
// PANTALLA PRINCIPAL DEL EXAMEN
// ========================================================================

export default function PantallaExamen() {
  const router = useRouter();
  const { width: anchoPantalla } = useWindowDimensions();
  const esEscritorio = anchoPantalla >= BP_ESCRITORIO;
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
  const [iniciado, setIniciado] = useState(false);
  const [aceptoProtocolo, setAceptoProtocolo] = useState(false);

  const intentosSalida = useRef(0);
  const salioEn = useRef<number | null>(null);
  const enviarExamenRef = useRef<(porTiempo?: boolean) => void>(() => {});
  const claveAlumno = `examen_${aspirante?.folio ?? "sin_folio"}`;

  // --- Configuración de seguridad del bloque ---
  // Si CUALQUIERA de los bloques que componen el examen del aspirante pide
  // bloqueo de capturas o de navegación, se aplica a toda la sesión (no
  // tendría sentido bajar la guardia a mitad del examen solo porque una
  // de las materias no lo marcó).
  const bloqueoCapturasActivo = preguntas.some((p) => p.bloqueo_capturas);
  const bloqueoNavegacionActivo = preguntas.some((p) => p.bloqueo_navegacion);
  const [contenidoOculto, setContenidoOculto] = useState(false);

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

        // Verificación de seguridad contra el servidor (no contra datos en
        // caché ni contra lo que haya en AsyncStorage): si el aspirante ya
        // terminó su examen o está en revisión, no lo dejamos entrar de
        // nuevo aunque haya llegado aquí directamente (botón "atrás" del
        // navegador, URL guardada, etc.), sin depender únicamente de que
        // el botón esté oculto en la pantalla de perfil.
        const datosServidor = await obtenerAspirantePorId(aspiranteActual.id);
        const estadoServidor = datosServidor?.estado;
        if (estadoServidor === "terminado" || estadoServidor === "en_revision") {
          await AsyncStorage.multiRemove([
            `examen_${aspiranteActual.folio}_indice`,
            `examen_${aspiranteActual.folio}_tiempo`,
          ]);
          Alert.alert(
            "Examen ya presentado",
            "Ya presentaste este examen. No puedes volver a intentarlo.",
          );
          router.replace("/perfil-aspirante");
          return;
        }

        // Verificación contra el servidor de que el admin ya registró la
        // asistencia (escaneo de QR) de este aspirante. Sin esto, alguien
        // podría llegar directo a esta pantalla (URL guardada, "atrás" del
        // navegador, etc.) y presentar el examen sin haberse presentado
        // físicamente en la sede.
        if (datosServidor?.asistencia !== true) {
          Alert.alert(
            "Aún no puedes presentar el examen",
            "Primero debes registrar tu asistencia en la sede con el administrador.",
          );
          router.replace("/perfil-aspirante");
          return;
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
        if (tiempoGuardado[1]) {
          setSegundosRestantes(JSON.parse(tiempoGuardado[1]));
          // Ya había un examen en curso (p.ej. se recargó la página):
          // saltamos la pantalla de instrucciones directo a la pregunta.
          setIniciado(true);
        }
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
    if (cargando || enviado || !iniciado) return;

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
  }, [cargando, enviado, iniciado, claveAlumno]);

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

  // --- Bloqueo de capturas de pantalla ---
  // Solo se activa si algún bloque del examen lo pidió explícitamente
  // (bloqueoCapturasActivo). En nativo (Android/iOS) se apoya en el
  // sistema operativo vía expo-screen-capture, que sí puede impedir de
  // verdad la captura/grabación de pantalla. En web no existe una API que
  // impida una captura física (tecla ImprPant, herramientas del SO, otro
  // dispositivo fotografiando la pantalla), así que ahí se aplican
  // medidas disuasivas: bloquear el menú contextual, el copiado, y
  // difuminar el contenido mientras la ventana pierde el foco (evita
  // dejar la pregunta visible en apps de captura en segundo plano).
  useEffect(() => {
    if (!bloqueoCapturasActivo || !iniciado || enviado) return;

    if (Platform.OS !== "web") {
      ScreenCapture.preventScreenCaptureAsync().catch((error) => {
        console.warn("No se pudo activar el bloqueo de capturas:", error);
      });
      return () => {
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      };
    }

    if (typeof document !== "undefined" && typeof window !== "undefined") {
      const bloquearMenuOCopiado = (e: Event) => e.preventDefault();
      const alPerderFoco = () => setContenidoOculto(true);
      const alGanarFoco = () => setContenidoOculto(false);

      document.addEventListener("contextmenu", bloquearMenuOCopiado);
      document.addEventListener("copy", bloquearMenuOCopiado);
      window.addEventListener("blur", alPerderFoco);
      window.addEventListener("focus", alGanarFoco);

      return () => {
        document.removeEventListener("contextmenu", bloquearMenuOCopiado);
        document.removeEventListener("copy", bloquearMenuOCopiado);
        window.removeEventListener("blur", alPerderFoco);
        window.removeEventListener("focus", alGanarFoco);
        setContenidoOculto(false);
      };
    }
  }, [bloqueoCapturasActivo, iniciado, enviado]);

  // --- Detección de cambio de estado de la app ---
  // Antes se contaba como "intento de salir" cualquier pérdida de foco,
  // incluso momentánea (por ejemplo, una notificación, cambiar de
  // pestaña un instante, o el navegador perdiendo el foco). Eso hacía que
  // el aviso apareciera todo el tiempo. Ahora solo cuenta si la app
  // permanece en segundo plano más de unos segundos, que es la señal real
  // de que el aspirante salió de la aplicación — salvo que el bloque haya
  // pedido "bloqueo de navegación" estricto, en cuyo caso CUALQUIER salida
  // (sin importar cuánto haya durado, y sin margen de advertencia previa)
  // anula el intento de inmediato.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (enviado || !iniciado) return;

      if (nextAppState === "background" || nextAppState === "inactive") {
        salioEn.current = Date.now();
        if (bloqueoNavegacionActivo) {
          enviarExamenRef.current(true);
        }
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
  }, [enviado, iniciado, bloqueoNavegacionActivo]);

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

        // El modo de calificación (inmediato/programado) y la fecha de
        // publicación viven en el examen, no en el aspirante. Vienen ya
        // aplanados en cada pregunta gracias a aplanarPreguntaConExamen.
        const modoCalificacion = preguntas[0]?.modo_calificacion ?? "inmediato";
        const fechaPublicacion = preguntas[0]?.fecha_publicacion ?? null;
        const yaSePuedePublicar =
          !fechaPublicacion || new Date(fechaPublicacion) <= new Date();
        const estadoFinal =
          modoCalificacion === "programado" && !yaSePuedePublicar
            ? "en_revision"
            : "terminado";

        try {
          const guardadoExitoso = await finalizarExamen({
            idAspirante: aspirante.id,
            aciertos,
            total: preguntas.length,
            calificacion,
            estado: estadoFinal,
            modoCalificacion,
            fechaPublicacion,
          });

          if (!guardadoExitoso) {
            // No lo tratamos como enviado: si seguimos de largo aquí (como
            // pasaba antes) el examen nunca queda marcado como terminado
            // en el servidor y el aspirante puede volver a presentarlo.
            throw new Error("No se pudo guardar el resultado en el servidor.");
          }

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

  if (!iniciado) {
    return (
      <PantallaInstrucciones
        aspirante={aspirante}
        totalPreguntas={preguntas.length}
        duracionMinutos={Math.round(segundosRestantes / 60)}
        acepto={aceptoProtocolo}
        onCambiarAcepto={setAceptoProtocolo}
        onIniciar={() => setIniciado(true)}
        esEscritorio={esEscritorio}
        bloqueoCapturasActivo={bloqueoCapturasActivo}
        bloqueoNavegacionActivo={bloqueoNavegacionActivo}
      />
    );
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
        esEscritorio={esEscritorio}
      />

      {contenidoOculto && (
        <View style={styles.overlayOculto} pointerEvents="none">
          <Ionicons name="eye-off-outline" size={28} color="white" />
          <Text style={styles.overlayOcultoTexto}>
            Contenido oculto por seguridad
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          esEscritorio && styles.scrollContainerEscritorio,
        ]}
      >
        <View
          style={[
            styles.preguntaContainer,
            esEscritorio && styles.preguntaContainerEscritorio,
          ]}
        >
          <View style={styles.preguntaAcento} />
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
          esEscritorio={esEscritorio}
        />
      </View>
    </View>
  );
}

// --- SUB-COMPONENTES DE LA PANTALLA ---

const SizedBox = ({ height }: { height: number }) => (
  <View style={{ height }} />
);

const PantallaInstrucciones = ({
  aspirante,
  totalPreguntas,
  duracionMinutos,
  acepto,
  onCambiarAcepto,
  onIniciar,
  esEscritorio,
  bloqueoCapturasActivo,
  bloqueoNavegacionActivo,
}: {
  aspirante: Aspirante;
  totalPreguntas: number;
  duracionMinutos: number;
  acepto: boolean;
  onCambiarAcepto: (valor: boolean) => void;
  onIniciar: () => void;
  esEscritorio?: boolean;
  bloqueoCapturasActivo?: boolean;
  bloqueoNavegacionActivo?: boolean;
}) => (
  <SafeAreaView style={styles.instruccionesContainer}>
    <LinearGradient
      colors={["#EEF1F8", "#E3E9FA", "#EDF0FA"]}
      style={StyleSheet.absoluteFill}
    />
    {/* Formas decorativas de fondo, solo estéticas */}
    <View style={styles.instruccionesBlobUno} pointerEvents="none" />
    <View style={styles.instruccionesBlobDos} pointerEvents="none" />

    <ScrollView
      contentContainerStyle={[
        styles.instruccionesScroll,
        esEscritorio && styles.instruccionesScrollEscritorio,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.instruccionesTarjeta,
          esEscritorio && styles.instruccionesTarjetaEscritorio,
        ]}
      >
        {/* --- Franja lateral institucional (ícono + texto vertical + cámara) --- */}
        <LinearGradient
          colors={[ColoresApp.primario, ColoresApp.oscuro]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.instruccionesSidebar,
            esEscritorio && styles.instruccionesSidebarEscritorio,
          ]}
        >
          <View style={styles.instruccionesSidebarIconoCircle}>
            <Ionicons name="shield-checkmark" color="white" size={14} />
          </View>
          <View style={styles.instruccionesSidebarTextoWrap}>
            <Text
              style={styles.instruccionesSidebarTexto}
              numberOfLines={1}
            >
              INSTITUCIÓN EDUCATIVA SUPERIOR
            </Text>
          </View>
          <View style={styles.instruccionesSidebarCamaraCircle}>
            <Ionicons name="videocam" color="white" size={14} />
          </View>
        </LinearGradient>

        {/* --- Contenido --- */}
        <View
          style={[
            styles.instruccionesContenido,
            esEscritorio && styles.instruccionesContenidoEscritorio,
          ]}
        >
          <View style={styles.instruccionesEncabezado}>
            <View style={styles.instruccionesConvocatoriaBadge}>
              <Text style={styles.instruccionesConvocatoriaTexto}>
                CONVOCATORIA 2026
              </Text>
            </View>
            <Text style={styles.instruccionesFolio}>
              ID: {aspirante.folio}
            </Text>
          </View>

          <Text style={styles.instruccionesTitulo}>
            Examen de Admisión:{"\n"}
            <Text style={{ color: ColoresApp.primario }}>
              {aspirante.carreraNombre}
            </Text>
          </Text>

          <View style={styles.instruccionesDatosFila}>
            <View style={styles.instruccionesDatoCard}>
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={ColoresApp.primario}
              />
              <Text style={styles.instruccionesDatoNumero}>
                {totalPreguntas}
              </Text>
              <Text style={styles.instruccionesDatoEtiqueta}>Preguntas</Text>
            </View>
            <View style={styles.instruccionesDatoCard}>
              <Ionicons
                name="time-outline"
                size={18}
                color={ColoresApp.primario}
              />
              <Text style={styles.instruccionesDatoNumero}>
                {duracionMinutos}
              </Text>
              <Text style={styles.instruccionesDatoEtiqueta}>Minutos</Text>
            </View>
          </View>

          <Text style={styles.instruccionesProtocoloTitulo}>
            Protocolo de seguridad
          </Text>

          <View style={styles.instruccionesProtocoloItem}>
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.instruccionesProtocoloTexto}>
              <Text style={{ fontWeight: "700" }}>
                Navegación restringida:{" "}
              </Text>
              {bloqueoNavegacionActivo
                ? "cambiar de ventana o pestaña, o salir de la app durante el examen, anulará tu intento de inmediato."
                : "cambiar de ventana o pestaña durante el examen resultará en la anulación automática del intento tras una advertencia."}
            </Text>
          </View>
          <View style={styles.instruccionesProtocoloItem}>
            <Ionicons
              name="camera-outline"
              size={18}
              color={ColoresApp.primario}
            />
            <Text style={styles.instruccionesProtocoloTexto}>
              <Text style={{ fontWeight: "700" }}>
                Capturas de pantalla:{" "}
              </Text>
              {bloqueoCapturasActivo
                ? "las capturas y grabaciones de pantalla están bloqueadas durante el examen."
                : "el sistema registra intentos de salir de la app o cambiar de pestaña durante tu intento."}
            </Text>
          </View>

          <Pressable
            style={styles.instruccionesCheckFila}
            onPress={() => onCambiarAcepto(!acepto)}
          >
            <View
              style={[
                styles.instruccionesCheckbox,
                acepto && styles.instruccionesCheckboxActivo,
              ]}
            >
              {acepto && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <Text style={styles.instruccionesCheckTexto}>
              He leído las instrucciones y acepto los términos de seguridad.
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.instruccionesBoton,
              !acepto && styles.instruccionesBotonDeshabilitado,
            ]}
            disabled={!acepto}
            onPress={onIniciar}
          >
            <Text style={styles.instruccionesBotonTexto}>Iniciar Examen</Text>
            <Ionicons name="arrow-forward" size={17} color="white" />
          </Pressable>

          <Text style={styles.instruccionesSoporteTexto}>
            ¿Problemas técnicos? Contacta a Vinculación.
          </Text>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>
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
  esEscritorio,
}: any) => (
  <LinearGradient colors={["#040D2A", "#0B2A55"]} style={styles.header}>
    <SafeAreaView>
      <View
        style={[
          styles.headerContent,
          esEscritorio && styles.headerContentEscritorio,
        ]}
      >
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
  esEscritorio,
}: any) => (
  <View
    style={[
      styles.botonesNavContainer,
      esEscritorio && styles.botonesNavContainerEscritorio,
    ]}
  >
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
  container: { flex: 1, backgroundColor: "transparent" },
  overlayOculto: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: "rgba(15,17,32,0.96)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  overlayOcultoTexto: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
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
    borderRadius: 12,
  },
  botonTexto: { color: "white", fontWeight: "bold" },
  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: "0 6px 16px #0000002A",
  },
  headerContent: { padding: 16, paddingTop: 0 },
  headerContentEscritorio: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: 8,
  },
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
    height: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4ADE80",
    borderRadius: 3,
  },
  progressTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  progressTexto: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  scrollContainer: { padding: 16, paddingTop: 22, alignItems: "center" },
  scrollContainerEscritorio: { paddingTop: 32, paddingBottom: 32 },
  preguntaContainer: {
    width: "100%",
    maxWidth: 760,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#ECEDF3",
    boxShadow: "0 8px 24px #0B1C300F",
    position: "relative",
    overflow: "hidden",
  },
  preguntaContainerEscritorio: { maxWidth: 860, padding: 32 },
  preguntaAcento: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: ColoresApp.primario,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  badgeTexto: { fontSize: 10, fontWeight: "bold", letterSpacing: 0.2 },
  preguntaTexto: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
    color: "#0B1C30",
    marginTop: 16,
    marginBottom: 20,
  },
  opcionContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: "white",
  },
  opcionSeleccionada: {
    borderColor: ColoresApp.primario,
    backgroundColor: "#EAF2FC",
    boxShadow: `0 4px 12px ${ColoresApp.primario}22`,
  },
  opcionLetraContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  opcionLetraTexto: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  opcionTexto: {
    flex: 1,
    marginLeft: 14,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#3C3C43",
  },
  opcionTextoSeleccionado: { color: "#0B1C30", fontWeight: "700" },
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
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
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
    boxShadow: "0 -4px 12px #0B1C300A",
  },
  puntoNav: { height: 8, borderRadius: 5, marginHorizontal: 3 },
  botonesNavContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: 760,
  },
  botonesNavContainerEscritorio: { maxWidth: 860 },
  botonNav: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#D7D9E0",
    gap: 6,
  },
  botonNavDisabled: { opacity: 0.5 },
  botonNavTexto: { color: "#4B5563", fontWeight: "bold" },
  botonNavSiguiente: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
    boxShadow: `0 6px 16px ${ColoresApp.primario}40`,
  },
  botonNavEnviar: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
    boxShadow: "0 6px 16px #16A34A40",
  },
  botonNavTextoPrincipal: { color: "white", fontWeight: "bold" },

  // --- Pantalla de instrucciones (antes de iniciar el examen) ---
  instruccionesContainer: { flex: 1, backgroundColor: "#EEF1F8" },
  instruccionesBlobUno: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: ColoresApp.primario,
    opacity: 0.08,
  },
  instruccionesBlobDos: {
    position: "absolute",
    bottom: -100,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: ColoresApp.oscuro,
    opacity: 0.06,
  },
  instruccionesScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  instruccionesScrollEscritorio: { padding: 40 },
  instruccionesTarjeta: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 480,
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECEDF3",
    boxShadow: "0 12px 32px #0B1C3018",
    overflow: "hidden",
  },
  instruccionesTarjetaEscritorio: { maxWidth: 620 },
  instruccionesSidebar: {
    width: 34,
    backgroundColor: ColoresApp.primario,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  instruccionesSidebarEscritorio: { width: 44, paddingVertical: 26 },
  instruccionesSidebarIconoCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  instruccionesSidebarTextoWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  instruccionesSidebarTexto: {
    width: 220,
    textAlign: "center",
    color: "rgba(255,255,255,0.85)",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    transform: [{ rotate: "-90deg" }],
  },
  instruccionesSidebarCamaraCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  instruccionesContenido: {
    flex: 1,
    padding: 24,
  },
  instruccionesContenidoEscritorio: { padding: 34 },
  instruccionesEncabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  instruccionesConvocatoriaBadge: {
    backgroundColor: ColoresApp.primario,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  instruccionesConvocatoriaTexto: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  instruccionesFolio: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  instruccionesTitulo: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B1C30",
    lineHeight: 27,
    marginBottom: 16,
  },
  instruccionesDatosFila: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  instruccionesDatoCard: {
    flex: 1,
    backgroundColor: "#F5F6FA",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    gap: 2,
  },
  instruccionesDatoNumero: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B1C30",
    marginTop: 2,
  },
  instruccionesDatoEtiqueta: {
    fontSize: 10.5,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  instruccionesProtocoloTitulo: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B1C30",
    marginBottom: 10,
  },
  instruccionesProtocoloItem: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  instruccionesProtocoloTexto: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: "#3C3C43",
  },
  instruccionesCheckFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 18,
  },
  instruccionesCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#C6C6CE",
    alignItems: "center",
    justifyContent: "center",
  },
  instruccionesCheckboxActivo: {
    backgroundColor: ColoresApp.primario,
    borderColor: ColoresApp.primario,
  },
  instruccionesCheckTexto: {
    flex: 1,
    fontSize: 12,
    color: "#3C3C43",
    lineHeight: 17,
  },
  instruccionesBoton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: ColoresApp.primario,
    borderRadius: 14,
    paddingVertical: 15,
    boxShadow: `0 8px 20px ${ColoresApp.primario}40`,
  },
  instruccionesBotonDeshabilitado: {
    backgroundColor: "#B8C4D9",
    boxShadow: "none",
  },
  instruccionesBotonTexto: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  instruccionesSoporteTexto: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 14,
  },
});