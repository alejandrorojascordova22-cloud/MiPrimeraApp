import { ColoresApp } from "@/constants/coloresApp";
import { Ionicons } from "@expo/vector-icons";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import BannerPermisoNotificaciones from "@/components/BannerPermisoNotificaciones";
import {
  obtenerAspirantePorId,
  registrarAspirante,
} from "@/services/aspirantesServicio";
import { contarAvisosNoLeidos } from "@/services/avisosServicio";
import {
  obtenerCronograma,
  type ActividadCronograma,
} from "@/services/cronogramaServicio";
import { obtenerPreguntas } from "@/services/preguntasExamenesServicio";
import { guardarTokenPush } from "@/services/pushRegistroServicio";
import {
  cerrarTodasLasSesiones,
  guardarSesionAspirante,
  obtenerSesionAspirante,
} from "@/services/sesionServicio";
import { supabase } from "@/services/supabaseClient";
import { mostrarNotificacionWeb } from "@/services/webNotificacionesServicio";
import { aspiranteFromMap, type Aspirante } from "@/types/aspirante";
import {
  estadoDeActividad,
  ETIQUETA_ESTADO_ACTIVIDAD,
  iconoPorActividad,
} from "@/utils/cronogramaVisualUtils";
import { obtenerTokenPushDispositivo } from "@/utils/pushDispositivo";

const aspiranteVacio: Aspirante = {
  id: 0,
  nombre: "",
  correo: "",
  folio: "",
  carreraId: 0,
  carreraNombre: "",
  estado: "pendiente",
  asistencia: false,
  resultado: null,
  aciertos: null,
  modo_calificacion: "inmediato" as "inmediato" | "programado",
  fecha_publicacion_calificacion: null as string | null,

  fecha_inicio_examen: null,
  fecha_fin_examen: null,
};

// --- PALETA DE COLORES DEL TEMA (dashboard morado, inspirado en Admissions Pro) ---
const theme = {
  // Fondo general de la app (contenido)
  bgApp: "#F5F3FB",
  blanco: "#FFFFFF",
  negro: "#0F0D17",

  // Texto
  texto: "#1E1B29",
  textoSecundario: "#8B8698",
  textoTerciario: "#B4AFC2",

  // Bordes / superficies
  borde: "#ECE9F4",
  fondoSuave: "#F3F1FA",

  // Marca / acento morado
  morado: "#7C3AED",
  moradoOscuro: "#5B21B6",
  moradoClaro: "#9061F9",
  moradoFondo: "#F1EBFE",

  // Sidebar (oscuro)
  sidebarBg: "#17131F",
  sidebarBgAlt: "#1E1929",
  sidebarTexto: "#B7B2C6",
  sidebarTextoActivo: "#FFFFFF",
  sidebarBorde: "rgba(255,255,255,0.06)",

  // Acento secundario (carrera / info)
  teal: "#0E9BA8",
  tealFondo: "#DCFAFB",

  // Semánticos
  verde: ColoresApp.exito ?? "#16A34A",
  verdeFondo: "#DCFCE7",
  verdeBorde: "#BBF0CE",
  amarillo: ColoresApp.advertencia ?? "#D97706",
  amarilloFondo: "#FDF3E1",
  amarilloBorde: "#F3DFAF",
  rojo: "#DC2626",
  rojoFondo: "#FBEAEA",
  rojoBorde: "#F2C6C6",
  gris: "#9C97AC",
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Breakpoints
const BP_TABLET = 768;
const BP_DESKTOP = 1024;

// Navegación decorativa del sidebar / drawer.
// Solo "Mi proceso" está implementado; el resto queda preparado para el futuro.
const NAV_ITEMS = [
  { key: "inicio", label: "Inicio", icon: "home-outline" as const },
  {
    key: "documentos",
    label: "Documentos",
    icon: "folder-open-outline" as const,
  },
  {
    key: "notificaciones",
    label: "Notificaciones",
    icon: "notifications-outline" as const,
  },
  {
    key: "actividades",
    label: "Diagrama de actividades",
    icon: "calendar-outline" as const,
  },
  { key: "ajustes", label: "Ajustes", icon: "settings-outline" as const },
  {
    key: "ayuda",
    label: "Ayuda y soporte",
    icon: "help-circle-outline" as const,
  },
];

export default function PantallaPerfilAspirante() {
  const router = useRouter();
  const { aspiranteId } = useLocalSearchParams<{ aspiranteId?: string }>();
  const { width } = useWindowDimensions();

  const isDesktop = width >= BP_DESKTOP;
  const isTablet = width >= BP_TABLET && width < BP_DESKTOP;
  const showSidebar = isDesktop || isTablet;
  const showTwoColumns = width >= BP_TABLET;

  const [aspirante, setAspirante] = useState<Aspirante>(aspiranteVacio);
  const asistenciaPreviaRef = useRef<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [examenDisponible, setExamenDisponible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isQrModalVisible, setQrModalVisible] = useState(false);
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isAsistenciaModalVisible, setAsistenciaModalVisible] = useState(false);

  const [cronograma, setCronograma] = useState<ActividadCronograma[]>([]);

  const cargarEstado = useCallback(async () => {
    try {
      let idActual = Number(aspiranteId) || 0;
      if (!idActual) {
        const sesion = await obtenerSesionAspirante();
        if (!sesion) {
          router.replace("/login");
          return;
        }
        idActual = sesion.id;
      }

      const [datosAspirante, actividades] = await Promise.all([
        obtenerAspirantePorId(idActual),
        obtenerCronograma(),
      ]);

      if (!datosAspirante) {
        router.replace("/login");
        return;
      }

      const aspiranteConvertido = aspiranteFromMap(datosAspirante);

      console.log("[Notif] cargarEstado check", {
        previo: asistenciaPreviaRef.current,
        actual: aspiranteConvertido.asistencia,
      });

      // Respaldo de la notificación de asistencia: si detectamos que
      // pasó de "no registrada" a "registrada" (por ejemplo, alguien
      // escaneó su QR mientras esta pantalla no tenía la conexión en
      // vivo activa), mostramos la ventanita igual, sin depender de
      // que Realtime haya llegado a tiempo.
      if (
        asistenciaPreviaRef.current === false &&
        aspiranteConvertido.asistencia === true
      ) {
        console.log("[Notif] mostrando alerta de asistencia registrada");
        setAsistenciaModalVisible(true);
      }
      asistenciaPreviaRef.current = aspiranteConvertido.asistencia;

      setAspirante(aspiranteConvertido);
      setCronograma(actividades);

      const preguntas = await obtenerPreguntas(aspiranteConvertido.carreraId);
      setExamenDisponible(
        preguntas.length > 0 && aspiranteConvertido.asistencia,
      );
    } catch {
      Alert.alert("Error", "No se pudo cargar la información del perfil.");
    } finally {
      setCargando(false);
    }
  }, [aspiranteId, router]);

  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => {
        cargarEstado();
      }, 0);

      // Respaldo extra: mientras el aspirante tiene esta pantalla
      // abierta (por ejemplo esperando a que lo formen para el
      // examen), revisamos cada 10s si ya se registró su asistencia,
      // sin depender únicamente de la conexión en vivo de Realtime.
      const intervalo = setInterval(() => {
        cargarEstado();
      }, 10000);

      return () => {
        clearTimeout(id);
        clearInterval(intervalo);
      };
    }, [cargarEstado]),
  );

  // Escucha en tiempo real cuando se registra la asistencia de ESTE
  // aspirante (por ejemplo, al escanear su QR el día del examen) y le
  // muestra una ventanita avisándole.
  const canalAsistenciaRef = useRef<any>(null);

  useEffect(() => {
    if (!aspirante.id) return;

    let cancelado = false;

    const iniciarCanal = async () => {
      // Defensa contra condición de carrera: `supabase.removeChannel` es
      // asíncrono (primero hace unsubscribe y solo después de resolver esa
      // promesa lo quita de la lista interna de canales). Si este efecto
      // se vuelve a ejecutar antes de que termine esa limpieza (navegación
      // rápida, remounts, Fast Refresh, doble efecto de React en dev),
      // `supabase.channel(mismoNombre)` regresa el canal VIEJO —que ya
      // está suscrito— y el `.on(...)` de abajo truena con:
      // "cannot add postgres_changes callbacks ... after subscribe()".
      // Por eso, antes de crear el canal nuevo, nos aseguramos de que
      // cualquier canal previo con el mismo topic ya esté completamente
      // removido.
      const topic = `realtime:asistencia-aspirante-${aspirante.id}`;
      const canalPrevio = supabase
        .getChannels()
        .find((c) => c.topic === topic);
      if (canalPrevio) {
        console.log(
          "[Notif] removiendo canal realtime previo antes de recrear",
          aspirante.id,
        );
        try {
          await supabase.removeChannel(canalPrevio);
        } catch {
          // Si falla la remoción igual seguimos: mejor intentar crear
          // el canal nuevo que quedarnos sin escucha en tiempo real.
        }
      }

      if (cancelado) return;

      const canal = supabase
        .channel(`asistencia-aspirante-${aspirante.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "asistencias",
            filter: `aspirante_id=eq.${aspirante.id}`,
          },
          (payload) => {
            console.log("[Notif] evento realtime recibido", payload);
            setAsistenciaModalVisible(true);
          },
        )
        .subscribe((estado) => {
          console.log("[Notif] estado de suscripción realtime:", estado);
        });

      canalAsistenciaRef.current = canal;
    };

    iniciarCanal();

    return () => {
      cancelado = true;
      const canalActual = canalAsistenciaRef.current;
      canalAsistenciaRef.current = null;
      if (canalActual) {
        console.log(
          "[Notif] desuscribiendo canal realtime para aspirante",
          aspirante.id,
        );
        supabase.removeChannel(canalActual).catch(() => {});
      }
    };
  }, [aspirante.id]);

  // Registra el token de push de este dispositivo apenas sabemos quién
  // es el aspirante. No bloquea nada si falla (permiso negado, emulador,
  // etc.) — el resto de la pantalla sigue funcionando igual.
  useEffect(() => {
    if (!aspirante.id) return;
    let cancelado = false;

    (async () => {
      const token = await obtenerTokenPushDispositivo();
      if (!token || cancelado) return;
      await guardarTokenPush({
        aspiranteId: aspirante.id,
        token,
        plataforma: Platform.OS,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [aspirante.id]);

  const cerrarSesion = async () => {
    await cerrarTodasLasSesiones();
    router.replace("/login");
  };

  const examenFinalizado =
    aspirante.estado === "terminado" || aspirante.estado === "en_revision";

  const getEstadoInfo = () => {
    switch (aspirante.estado) {
      case "terminado":
        return { texto: "Finalizado", color: theme.verde };
      case "en_revision":
        return { texto: "En revisión", color: theme.amarillo };
      case "en_progreso":
        return { texto: "En progreso", color: theme.morado };
      default:
        return { texto: "Registrado", color: theme.gris };
    }
  };

  const iniciarExamen = async () => {
    router.push("/examen");
  };

  // Notificación de avisos nuevos mientras el aspirante está en cualquier
  // parte de su portal (no solo dentro de avisos-aspirante). El contador
  // del sidebar/drawer sigue con su polling de 60s como respaldo; esto es
  // lo que dispara la notificación real del navegador al instante.
  useEffect(() => {
    if (!aspirante.id) return;

    const canal = supabase
      .channel(`avisos-notif-${aspirante.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "avisos" },
        (payload) => {
          const nuevo = payload.new as {
            titulo: string;
            contenido: string;
            carrera_id: number | null;
            id: number;
          };
          if (
            nuevo.carrera_id === null ||
            nuevo.carrera_id === aspirante.carreraId
          ) {
            mostrarNotificacionWeb(nuevo.titulo, {
              cuerpo: nuevo.contenido,
              datos: { avisoId: nuevo.id },
              alHacerClick: () =>
                router.push({
                  pathname: "/avisos-aspirante",
                  params: {
                    aspiranteId: String(aspirante.id),
                    carreraId: String(aspirante.carreraId),
                  },
                }),
            });
          }
        },
      )
      .subscribe((status) => {
        console.log("Realtime avisos (perfil-aspirante):", status);
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [aspirante.id, aspirante.carreraId, router]);

  return (
    <View style={styles.appShell}>
      <Stack.Screen options={{ headerShown: false }} />

      {showSidebar && (
        <Sidebar
          aspirante={aspirante}
          onLogout={cerrarSesion}
          collapsed={isTablet}
          cronograma={cronograma}
        />
      )}

      <View style={styles.mainColumn}>
        {!showSidebar && (
          <Pressable
            onPress={() => setDrawerVisible(true)}
            style={styles.floatingMenuButton}
          >
            <Ionicons name="menu-outline" size={22} color={theme.texto} />
          </Pressable>
        )}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <BannerPermisoNotificaciones
            aspiranteId={aspirante.id || undefined}
          />
          <View
            style={[styles.contentContainer, !showSidebar && { maxWidth: 720 }]}
          >
            <ProfileHeaderCard
              aspirante={aspirante}
              estadoInfo={getEstadoInfo()}
              onEdit={() => setEditModalVisible(true)}
              onShowQr={() => setQrModalVisible(true)}
            />

            <SizedBox height={20} />

            <View
              style={[
                styles.gridRow,
                !showTwoColumns && { flexDirection: "column" },
              ]}
            >
              {/* Columna izquierda */}
              <View
                style={[
                  styles.gridColMain,
                  !showTwoColumns && styles.gridColFull,
                ]}
              >
                <CardDatos aspirante={aspirante} />
                <SizedBox height={16} />
                {cargando ? (
                  <Card>
                    <ActivityIndicator color={theme.morado} />
                  </Card>
                ) : examenFinalizado ? (
                  <CardResultado aspirante={aspirante} />
                ) : (
                  <CardExamen
                    disponible={examenDisponible}
                    asistencia={aspirante.asistencia}
                    onIniciar={iniciarExamen}
                  />
                )}
              </View>

              {/* Columna derecha */}
              <View
                style={[
                  styles.gridColSide,
                  !showTwoColumns && styles.gridColFull,
                ]}
              >
                {!showTwoColumns && <SizedBox height={0} />}
                <CardCarrera aspirante={aspirante} />
                <SizedBox height={16} />
                <CardCronograma actividades={cronograma} />
                <SizedBox height={16} />
                <CardProceso />
                <SizedBox height={16} />
                {!examenFinalizado && <CardManualUsuario />}
              </View>
            </View>

            <SizedBox height={28} />
            {!showSidebar && <BotonCerrarSesion onPress={cerrarSesion} />}
          </View>
        </ScrollView>
      </View>

      <DrawerMovil
        visible={isDrawerVisible}
        onClose={() => setDrawerVisible(false)}
        aspirante={aspirante}
        onLogout={cerrarSesion}
        cronograma={cronograma}
      />

      <ModalEditar
        visible={isEditModalVisible}
        aspirante={aspirante}
        onClose={() => setEditModalVisible(false)}
        onSave={async (nuevosDatos: Record<string, any>) => {
          const actualizado = await registrarAspirante({
            id: aspirante.id,
            nombre: nuevosDatos.nombre,
            correo: nuevosDatos.correo,
            idCarrera: aspirante.carreraId,
            folio: aspirante.folio,
          });
          if (actualizado) {
            const aspiranteActualizado = { ...aspirante, ...nuevosDatos };
            setAspirante(aspiranteActualizado);
            await guardarSesionAspirante({
              ...aspiranteActualizado,
              carrera_id: aspiranteActualizado.carreraId,
              carrera_nombre: aspiranteActualizado.carreraNombre,
            });
          } else {
            Alert.alert("Error", "No se pudieron guardar los cambios.");
          }
          setEditModalVisible(false);
        }}
      />
      <ModalQR
        visible={isQrModalVisible}
        aspirante={aspirante}
        onClose={() => setQrModalVisible(false)}
      />
      <ModalAsistenciaRegistrada
        visible={isAsistenciaModalVisible}
        onClose={() => setAsistenciaModalVisible(false)}
      />
    </View>
  );
}

const ModalAsistenciaRegistrada = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalContainer, { alignItems: "center" }]}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.verdeFondo,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Ionicons name="checkmark-circle" size={34} color={theme.verde} />
        </View>
        <Text style={styles.modalTitle}>Asistencia registrada</Text>
        <Text style={[styles.modalSubtitle, { marginTop: 6 }]}>
          Tu asistencia al examen fue registrada correctamente.
        </Text>
        <Pressable
          style={[
            styles.botonPrimario,
            { marginTop: 18, alignSelf: "stretch", justifyContent: "center" },
          ]}
          onPress={onClose}
        >
          <Text style={styles.textoBotonPrimario}>Entendido</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

// --- SIDEBAR (desktop / tablet) ---

const Sidebar = ({
  aspirante,
  onLogout,
  collapsed,
  cronograma,
}: {
  aspirante: Aspirante;
  onLogout: () => void;
  collapsed?: boolean;
  cronograma: ActividadCronograma[];
}) => {
  const router = useRouter();
  const [isActividadesVisible, setActividadesVisible] = useState(false);
  const [isAyudaVisible, setAyudaVisible] = useState(false);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [avisosNoLeidos, setAvisosNoLeidos] = useState(0);

  useEffect(() => {
    let activo = true;
    const cargarContador = async () => {
      const total = await contarAvisosNoLeidos(
        aspirante.id,
        aspirante.carreraId,
      );
      if (activo) setAvisosNoLeidos(total);
    };
    cargarContador();
    // Refresca cada 60s por si llega un aviso nuevo mientras el aspirante
    // sigue navegando en la app sin recargar la pantalla.
    const intervalo = setInterval(cargarContador, 60000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [aspirante.id, aspirante.carreraId]);

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={styles.sidebarLogoRow}>
        <View style={styles.sidebarLogoBox}>
          <Ionicons name="school" size={18} color={theme.blanco} />
        </View>
        {!collapsed && (
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.sidebarLogoTitle}>Admisiones</Text>
            <Text style={styles.sidebarLogoSubtitle}>Portal del aspirante</Text>
          </View>
        )}
      </View>

      <SizedBox height={22} />

      <View style={{ paddingHorizontal: collapsed ? 8 : 12 }}>
        {NAV_ITEMS.map((item) => {
          const activo = item.key === "inicio";
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (item.key === "notificaciones") {
                  router.push({
                    pathname: "/avisos-aspirante",
                    params: {
                      aspiranteId: String(aspirante.id),
                      carreraId: String(aspirante.carreraId),
                    },
                  });
                } else if (item.key === "documentos") {
                  router.push("/documentos-aspirante");
                } else if (item.key === "actividades") {
                  setActividadesVisible(true);
                } else if (item.key === "ajustes") {
                  router.push("/ajustes-aspirante");
                } else if (item.key === "ayuda") {
                  setAyudaVisible(true);
                }
              }}
              style={[
                styles.sidebarNavItem,
                activo && styles.sidebarNavItemActivo,
                collapsed && { justifyContent: "center", paddingHorizontal: 0 },
              ]}
            >
              <View>
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={activo ? theme.sidebarTextoActivo : theme.sidebarTexto}
                />
                {item.key === "notificaciones" && avisosNoLeidos > 0 && (
                  <View style={styles.sidebarBadge}>
                    <Text style={styles.sidebarBadgeTexto}>
                      {avisosNoLeidos > 9 ? "9+" : avisosNoLeidos}
                    </Text>
                  </View>
                )}
              </View>
              {!collapsed && (
                <Text
                  style={[
                    styles.sidebarNavText,
                    activo && {
                      color: theme.sidebarTextoActivo,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              )}
              {!collapsed &&
                item.key === "notificaciones" &&
                avisosNoLeidos > 0 && (
                  <View style={styles.sidebarBadgePill}>
                    <Text style={styles.sidebarBadgeTexto}>
                      {avisosNoLeidos > 9 ? "9+" : avisosNoLeidos}
                    </Text>
                  </View>
                )}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View
        style={{ paddingHorizontal: collapsed ? 8 : 12, paddingBottom: 18 }}
      >
        <SidebarFooterItem
          icon="log-out-outline"
          label="Cerrar sesión"
          collapsed={collapsed}
          onPress={onLogout}
        />
      </View>

      <Modal
        visible={isActividadesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActividadesVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Diagrama de actividades</Text>
              <Pressable onPress={() => setActividadesVisible(false)}>
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.textoSecundario}
                />
              </Pressable>
            </View>
            <SizedBox height={14} />
            <ScrollView style={{ maxHeight: 420 }}>
              {cronograma.length === 0 ? (
                <Text style={styles.modalSubtitle}>
                  Aún no hay actividades publicadas en el cronograma.
                </Text>
              ) : (
                <View>
                  {cronograma.map((act, index) => (
                    <FilaCronograma
                      key={act.id}
                      actividad={act}
                      esUltimo={index === cronograma.length - 1}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAyudaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAyudaVisible(false);
          setMostrarManual(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ayuda y soporte</Text>
              <Pressable
                onPress={() => {
                  setAyudaVisible(false);
                  setMostrarManual(false);
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.textoSecundario}
                />
              </Pressable>
            </View>
            <SizedBox height={14} />
            <Pressable
              style={styles.ayudaOpcion}
              onPress={() => setMostrarManual((v) => !v)}
            >
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={theme.morado}
              />
              <Text style={styles.ayudaOpcionTexto}>Manual de usuario</Text>
              <Ionicons
                name={mostrarManual ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textoSecundario}
              />
            </Pressable>
            {mostrarManual && (
              <View style={styles.manualBox}>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Mi proceso</Text> ves
                  tu folio, sede y el resultado de tu examen.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Documentos</Text>{" "}
                  están la guía de estudio y los materiales para prepararte.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Notificaciones</Text>{" "}
                  se avisa cuando cambia tu estado o hay novedades.
                </Text>
                <Text style={styles.manualItem}>
                  • En{" "}
                  <Text style={styles.manualNegrita}>
                    Diagrama de actividades
                  </Text>{" "}
                  está el cronograma completo del proceso de admisión.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Ajustes</Text> activas
                  notificaciones push, modo oscuro y cierras sesión.
                </Text>
              </View>
            )}
            <View style={styles.ayudaSeparador} />
            <Pressable
              style={styles.ayudaOpcion}
              onPress={() => {
                setAyudaVisible(false);
                setMostrarManual(false);
                Linking.openURL("mailto:soporte@admisiones.edu.mx");
              }}
            >
              <Ionicons
                name="mail-open-outline"
                size={18}
                color={theme.morado}
              />
              <Text style={styles.ayudaOpcionTexto}>Contactar soporte</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.textoSecundario}
              />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SidebarFooterItem = ({
  icon,
  label,
  collapsed,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  collapsed?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.sidebarNavItem,
      collapsed && { justifyContent: "center", paddingHorizontal: 0 },
    ]}
  >
    <Ionicons name={icon} size={16} color={theme.sidebarTexto} />
    {!collapsed && <Text style={styles.sidebarNavText}>{label}</Text>}
  </Pressable>
);

const Avatar = ({
  aspirante,
  size = 56,
}: {
  aspirante: Aspirante;
  size?: number;
}) => {
  const inicial = aspirante.nombre?.[0]?.toUpperCase() ?? "?";
  const fotoUrl = (aspirante as any)?.fotoUrl as string | undefined;

  if (fotoUrl) {
    return (
      <Image
        source={{ uri: fotoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: theme.fondoSuave,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: theme.moradoFondo,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: theme.morado,
          fontWeight: "800",
          fontSize: size * 0.38,
        }}
      >
        {inicial}
      </Text>
    </View>
  );
};

// --- SUB-COMPONENTES DE CONTENIDO ---

const SizedBox = ({ height, width }: { height?: number; width?: number }) => (
  <View style={{ height, width }} />
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.cardContainer}>{children}</View>
);

const ProfileHeaderCard = ({
  aspirante,
  estadoInfo,
  onEdit,
  onShowQr,
}: any) => (
  <View style={styles.profileHeaderCard}>
    <Avatar aspirante={aspirante} size={64} />
    <View style={{ flex: 1, marginLeft: 16, minWidth: 160 }}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {aspirante.nombre || "Aspirante"}
      </Text>
      <Text style={styles.headerSubtitle}>EXAMEN DE ADMISIÓN 2026</Text>
      <SizedBox height={8} />
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: `${estadoInfo.color}20` },
        ]}
      >
        <View
          style={[styles.statusBadgeDot, { backgroundColor: estadoInfo.color }]}
        />
        <Text style={[styles.statusBadgeText, { color: estadoInfo.color }]}>
          {estadoInfo.texto}
        </Text>
      </View>
    </View>

    <View style={styles.profileHeaderActions}>
      <Pressable style={styles.botonSecundario} onPress={onShowQr}>
        <Ionicons name="qr-code-outline" size={15} color={theme.texto} />
        <Text style={styles.textoBotonSecundario}>Código QR</Text>
      </Pressable>
      <SizedBox width={10} />
      <Pressable style={styles.botonPrimario} onPress={onEdit}>
        <Ionicons name="create-outline" size={15} color={theme.blanco} />
        <Text style={styles.textoBotonPrimario}>Editar perfil</Text>
      </Pressable>
    </View>
  </View>
);

const CardCarrera = ({ aspirante }: { aspirante: Aspirante }) => (
  <Card>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={styles.carreraIconContainer}>
        <Ionicons name="flask-outline" color={theme.teal} size={20} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.campoEtiqueta}>CARRERA ASIGNADA</Text>
        <SizedBox height={4} />
        <Text style={styles.carreraNombre}>{aspirante.carreraNombre}</Text>
      </View>
    </View>
  </Card>
);

const CardDatos = ({ aspirante }: { aspirante: Aspirante }) => (
  <Card>
    <LabelSeccion icon="person-outline" texto="Información personal" />
    <SizedBox height={4} />
    <View style={styles.datosGrid}>
      <Campo etiqueta="Nombre completo" valor={aspirante.nombre} />
      <Campo etiqueta="Correo electrónico" valor={aspirante.correo} />
      <Campo
        etiqueta="Folio"
        valor={aspirante.folio}
        colorValor={theme.morado}
        mono
      />
      <Campo etiqueta="Sede" valor="Oriental, Pue." />
    </View>
  </Card>
);

const CardExamen = ({ disponible, asistencia, onIniciar }: any) => (
  <Card>
    <LabelSeccion icon="document-text-outline" texto="Estado del examen" />
    <SizedBox height={14} />
    <View
      style={[
        styles.examenStatusBox,
        {
          backgroundColor: disponible ? theme.verdeFondo : theme.fondoSuave,
          borderColor: disponible ? theme.verdeBorde : theme.borde,
        },
      ]}
    >
      <View
        style={[
          styles.examenIconContainer,
          { backgroundColor: disponible ? "#C7F2D7" : "#E9E6F2" },
        ]}
      >
        <Ionicons
          name={disponible ? "checkmark-circle-outline" : "lock-closed-outline"}
          color={disponible ? theme.verde : theme.gris}
          size={18}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text
          style={[
            styles.examenStatusTitle,
            { color: disponible ? theme.verde : theme.textoSecundario },
          ]}
        >
          {disponible ? "Examen disponible" : "Aún no disponible"}
        </Text>
        <SizedBox height={3} />
        <Text style={styles.examenStatusDesc}>
          {disponible
            ? "El administrador habilitó tu examen. ¡Ya puedes presentarlo!"
            : asistencia
              ? "El administrador aún no ha publicado el examen para tu carrera."
              : "Registra tu asistencia en la sede antes de presentar el examen."}
        </Text>
      </View>
    </View>
    <SizedBox height={14} />
    <Pressable
      disabled={!disponible}
      onPress={onIniciar}
      style={({ pressed }) => [
        styles.botonExamen,
        { backgroundColor: disponible ? theme.morado : theme.fondoSuave },
        pressed && disponible && { opacity: 0.88 },
      ]}
    >
      <Ionicons
        name={disponible ? "play" : "lock-closed-outline"}
        size={18}
        color={disponible ? theme.blanco : theme.gris}
      />
      <SizedBox width={8} />
      <Text
        style={{
          color: disponible ? theme.blanco : theme.gris,
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        {disponible ? "Presentar examen" : "No disponible"}
      </Text>
    </Pressable>
  </Card>
);

const CardResultado = ({ aspirante }: { aspirante: Aspirante }) => {
  const enRevision = aspirante.estado === "en_revision";
  const calificacion = aspirante.resultado;
  const modoCalificacion = aspirante.modo_calificacion;
  const fechaPublicacion = aspirante.fecha_publicacion_calificacion
    ? new Date(aspirante.fecha_publicacion_calificacion)
    : null;
  const esProgramadoYNoDisponible =
    modoCalificacion === "programado" &&
    fechaPublicacion &&
    new Date() < fechaPublicacion;

  const fechaFormateada = fechaPublicacion
    ? fechaPublicacion.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  let colorCal = theme.textoSecundario;
  let mensajeCal = "Resultado disponible";
  if (calificacion != null) {
    if (calificacion >= 70) {
      colorCal = theme.verde;
      mensajeCal = "¡Calificación aprobatoria!";
    } else {
      colorCal = theme.rojo;
      mensajeCal = "Calificación reprobatoria";
    }
  }

  return (
    <Card>
      <LabelSeccion
        icon={enRevision ? "time-outline" : "trophy-outline"}
        texto={enRevision ? "En revisión" : "Resultado del examen"}
      />
      <SizedBox height={esProgramadoYNoDisponible ? 0 : 14} />
      {esProgramadoYNoDisponible ? (
        <MensajeProgramado fecha={fechaFormateada} />
      ) : enRevision ? (
        <View
          style={[
            styles.examenStatusBox,
            {
              backgroundColor: theme.amarilloFondo,
              borderColor: theme.amarilloBorde,
            },
          ]}
        >
          <View
            style={[styles.examenIconContainer, { backgroundColor: "#F5E6C8" }]}
          >
            <Ionicons name="time-outline" color={theme.amarillo} size={18} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.examenStatusTitle, { color: theme.amarillo }]}>
              Tu examen está siendo revisado
            </Text>
            <SizedBox height={3} />
            <Text style={styles.examenStatusDesc}>
              El resultado estará disponible una vez que el administrador
              finalice la revisión.
            </Text>
          </View>
        </View>
      ) : calificacion != null ? (
        <>
          <ScoreRing
            score={calificacion}
            mensaje={mensajeCal}
            color={colorCal}
            aciertos={aspirante.aciertos}
          />
          {aspirante.aciertos != null && (
            <>
              <SizedBox height={8} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <StatMini
                  valor={`${aspirante.aciertos}`}
                  etiqueta="Aciertos"
                  color={theme.verde}
                />
                <StatMini
                  valor={`${calificacion}`}
                  etiqueta="Calificación"
                  color={theme.morado}
                />
              </View>
            </>
          )}
        </>
      ) : (
        <View
          style={[
            styles.examenStatusBox,
            { backgroundColor: theme.fondoSuave, borderColor: theme.borde },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            color={theme.textoSecundario}
            size={20}
          />
          <SizedBox width={12} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: theme.textoSecundario,
              lineHeight: 18,
            }}
          >
            Examen enviado. El resultado será publicado próximamente.
          </Text>
        </View>
      )}
    </Card>
  );
};

const MensajeProgramado = ({ fecha }: { fecha: string }) => (
  <View
    style={[
      styles.examenStatusBox,
      {
        marginTop: 14,
        backgroundColor: theme.moradoFondo,
        borderColor: theme.borde,
      },
    ]}
  >
    <View style={[styles.examenIconContainer, { backgroundColor: "#E9E6F2" }]}>
      <Ionicons name="calendar-outline" color={theme.morado} size={18} />
    </View>
    <View style={{ flex: 1, marginLeft: 14 }}>
      <Text style={[styles.examenStatusTitle, { color: theme.morado }]}>
        Calificación programada
      </Text>
      <SizedBox height={3} />
      <Text style={styles.examenStatusDesc}>
        Tu resultado estará disponible a partir del {fecha}.
      </Text>
    </View>
  </View>
);

/**
 * Antes esta sección mostraba los materiales de estudio. Esos materiales
 * ahora viven en su propia pantalla ("Documentos", ver
 * documentos-aspirante.tsx); aquí, en el resumen principal, se deja un
 * manual de usuario corto con lo que contiene el sistema.
 */
const ITEMS_MANUAL_USUARIO: {
  icon: keyof typeof Ionicons.glyphMap;
  texto: string;
}[] = [
  {
    icon: "document-text-outline",
    texto: '"Mi proceso": aquí ves tu estado, folio y avance del examen.',
  },
  {
    icon: "qr-code-outline",
    texto:
      "Tu código QR es para que te registren la asistencia el día del examen.",
  },
  {
    icon: "folder-open-outline",
    texto:
      '"Documentos": ahí están la guía de estudio y los materiales del admin.',
  },
  {
    icon: "notifications-outline",
    texto:
      '"Notificaciones": avisos importantes que publica el equipo de admisiones.',
  },
  {
    icon: "settings-outline",
    texto: '"Ajustes": tus datos de cuenta y cerrar sesión.',
  },
];

const CardManualUsuario = () => (
  <Card>
    <LabelSeccion icon="help-circle-outline" texto="Manual de usuario" />
    <SizedBox height={4} />
    <Text style={{ fontSize: 12, color: theme.textoSecundario }}>
      Guía rápida de lo que encuentras en el sistema:
    </Text>
    <SizedBox height={10} />
    {ITEMS_MANUAL_USUARIO.map((item, i) => (
      <View
        key={item.texto}
        style={{ marginBottom: i < ITEMS_MANUAL_USUARIO.length - 1 ? 10 : 0 }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View
            style={[
              styles.carreraIconContainer,
              {
                backgroundColor: theme.moradoFondo,
                width: 28,
                height: 28,
                marginTop: 1,
              },
            ]}
          >
            <Ionicons name={item.icon} color={theme.morado} size={14} />
          </View>
          <Text
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 12,
              color: theme.texto,
              lineHeight: 17,
            }}
          >
            {item.texto}
          </Text>
        </View>
      </View>
    ))}
  </Card>
);

const CardProceso = () => {
  const datos = [
    ["Convocatoria", "Enero - Agosto 2026"],
    ["Modalidad", "Presencial · Sede Oriental"],
    ["Duración del examen", "90 minutos · 50 reactivos"],
  ];
  return (
    <Card>
      <LabelSeccion icon="star-outline" texto="Datos del proceso" />
      <SizedBox height={6} />
      {datos.map(([etiqueta, valor]) => (
        <View key={etiqueta} style={styles.procesoRow}>
          <Text style={{ fontSize: 12, color: theme.textoSecundario }}>
            {etiqueta}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: theme.texto }}>
            {valor}
          </Text>
        </View>
      ))}
    </Card>
  );
};

const FilaCronograma = ({
  actividad,
  esUltimo,
}: {
  actividad: ActividadCronograma;
  esUltimo: boolean;
}) => {
  const estado = estadoDeActividad(actividad);
  const colorEstado = ETIQUETA_ESTADO_ACTIVIDAD[estado];
  const colorActividad = actividad.color_etiqueta || theme.morado;

  return (
    <View style={styles.actividadRow}>
      <View style={styles.actividadTimeline}>
        <View
          style={[
            styles.actividadIconoCircle,
            { backgroundColor: `${colorActividad}22` },
          ]}
        >
          <Ionicons
            name={iconoPorActividad(actividad.titulo)}
            size={13}
            color={colorActividad}
          />
        </View>
        {!esUltimo && <View style={styles.actividadLine} />}
      </View>
      <View style={styles.actividadContent}>
        <View style={styles.actividadTituloRow}>
          <Text style={styles.actividadTitulo} numberOfLines={1}>
            {actividad.titulo}
          </Text>
          <View
            style={[
              styles.actividadBadge,
              { backgroundColor: `${colorEstado.color}22` },
            ]}
          >
            <Text
              style={[styles.actividadBadgeTexto, { color: colorEstado.color }]}
            >
              {colorEstado.texto}
            </Text>
          </View>
        </View>
        <Text style={styles.actividadFecha}>
          {new Date(actividad.fecha_inicio).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
          })}
          {actividad.fecha_fin &&
            ` - ${new Date(actividad.fecha_fin).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
            })}`}
        </Text>
        {actividad.descripcion && (
          <Text style={styles.actividadDescripcion}>
            {actividad.descripcion}
          </Text>
        )}
      </View>
    </View>
  );
};

const CardCronograma = ({
  actividades,
}: {
  actividades: ActividadCronograma[];
}) => {
  if (actividades.length === 0) {
    return null; // No mostrar nada si no hay actividades
  }

  return (
    <Card>
      <LabelSeccion icon="calendar-outline" texto="Cronograma" />
      <SizedBox height={10} />
      <View>
        {actividades.map((act, index) => (
          <FilaCronograma
            key={act.id}
            actividad={act}
            esUltimo={index === actividades.length - 1}
          />
        ))}
      </View>
    </Card>
  );
};

const BotonCerrarSesion = ({ onPress }: { onPress: () => void }) => (
  <Pressable style={styles.botonCerrarSesion} onPress={onPress}>
    <Ionicons name="log-out-outline" size={15} color={theme.gris} />
    <Text style={styles.textoCerrarSesion}>Cerrar sesión</Text>
  </Pressable>
);

const LabelSeccion = ({
  icon,
  texto,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  texto: string;
}) => (
  <View style={styles.labelSeccion}>
    <Ionicons name={icon} size={13} color={theme.morado} />
    <SizedBox width={8} />
    <Text style={styles.textoLabelSeccion}>{texto.toUpperCase()}</Text>
  </View>
);

const Campo = ({ etiqueta, valor, colorValor, mono }: any) => (
  <View style={styles.campoContainer}>
    <Text style={styles.campoEtiqueta}>{etiqueta.toUpperCase()}</Text>
    <SizedBox height={4} />
    <Text
      style={[
        styles.campoValor,
        {
          color: colorValor ?? theme.texto,
          fontFamily: mono ? "monospace" : undefined,
        },
      ]}
    >
      {valor}
    </Text>
  </View>
);

const ScoreRing = ({ score, mensaje, color, aciertos }: any) => {
  const progress = useSharedValue(0);
  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withTiming(score / 100, { duration: 1200 });
  }, [score, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 140,
          height: 140,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width="140" height="140" viewBox="0 0 140 140">
          <Circle
            cx="70"
            cy="70"
            r={radius}
            stroke={theme.fondoSuave}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            cx="70"
            cy="70"
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </Svg>
        <View
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center" },
          ]}
        >
          <Text style={[styles.scoreText, { color }]}>{Math.round(score)}</Text>
          <Text style={styles.scoreLabel}>/100</Text>
        </View>
      </View>
      <SizedBox height={12} />
      <Text style={[styles.scoreMessage, { color }]}>{mensaje}</Text>
      {aciertos != null && (
        <>
          <SizedBox height={4} />
          <Text
            style={styles.aciertosText}
          >{`${aciertos} respuestas correctas`}</Text>
        </>
      )}
    </View>
  );
};

const StatMini = ({ valor, etiqueta, color }: any) => (
  <View style={styles.statMiniContainer}>
    <Text style={[styles.statMiniValor, { color }]}>{valor}</Text>
    <SizedBox height={2} />
    <Text style={styles.statMiniEtiqueta}>{etiqueta}</Text>
  </View>
);

// --- DRAWER MÓVIL (equivalente al sidebar en pantallas angostas) ---

const DrawerMovil = ({
  visible,
  onClose,
  aspirante,
  onLogout,
  cronograma,
}: {
  visible: boolean;
  onClose: () => void;
  aspirante: Aspirante;
  onLogout: () => void;
  cronograma: ActividadCronograma[];
}) => {
  const router = useRouter();
  const [isActividadesVisible, setActividadesVisible] = useState(false);
  const [isAyudaVisible, setAyudaVisible] = useState(false);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [avisosNoLeidos, setAvisosNoLeidos] = useState(0);

  useEffect(() => {
    let activo = true;
    const cargarContador = async () => {
      const total = await contarAvisosNoLeidos(
        aspirante.id,
        aspirante.carreraId,
      );
      if (activo) setAvisosNoLeidos(total);
    };
    cargarContador();
    const intervalo = setInterval(cargarContador, 60000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [aspirante.id, aspirante.carreraId]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.drawerBackdrop} onPress={onClose}>
        <Pressable
          style={styles.drawerPanel}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sidebarLogoRow}>
            <View style={styles.sidebarLogoBox}>
              <Ionicons name="school" size={18} color={theme.blanco} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.sidebarLogoTitle}>Admisiones</Text>
              <Text style={styles.sidebarLogoSubtitle}>
                Portal del aspirante
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.sidebarTexto} />
            </Pressable>
          </View>

          <SizedBox height={20} />

          {NAV_ITEMS.map((item) => {
            const activo = item.key === "inicio";
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.sidebarNavItem,
                  activo && styles.sidebarNavItemActivo,
                ]}
                onPress={() => {
                  onClose();
                  if (item.key === "notificaciones") {
                    router.push({
                      pathname: "/avisos-aspirante",
                      params: {
                        aspiranteId: String(aspirante.id),
                        carreraId: String(aspirante.carreraId),
                      },
                    });
                  } else if (item.key === "documentos") {
                    router.push("/documentos-aspirante");
                  } else if (item.key === "actividades") {
                    setActividadesVisible(true);
                  } else if (item.key === "ajustes") {
                    router.push("/ajustes-aspirante");
                  } else if (item.key === "ayuda") {
                    setAyudaVisible(true);
                  }
                }}
              >
                <View>
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={
                      activo ? theme.sidebarTextoActivo : theme.sidebarTexto
                    }
                  />
                  {item.key === "notificaciones" && avisosNoLeidos > 0 && (
                    <View style={styles.sidebarBadge}>
                      <Text style={styles.sidebarBadgeTexto}>
                        {avisosNoLeidos > 9 ? "9+" : avisosNoLeidos}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.sidebarNavText,
                    activo && {
                      color: theme.sidebarTextoActivo,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {item.key === "notificaciones" && avisosNoLeidos > 0 && (
                  <View style={styles.sidebarBadgePill}>
                    <Text style={styles.sidebarBadgeTexto}>
                      {avisosNoLeidos > 9 ? "9+" : avisosNoLeidos}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          <View style={{ flex: 1 }} />

          <SidebarFooterItem
            icon="log-out-outline"
            label="Cerrar sesión"
            onPress={onLogout}
          />
        </Pressable>
      </Pressable>

      <Modal
        visible={isActividadesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActividadesVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Diagrama de actividades</Text>
              <Pressable onPress={() => setActividadesVisible(false)}>
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.textoSecundario}
                />
              </Pressable>
            </View>
            <SizedBox height={14} />
            <ScrollView style={{ maxHeight: 420 }}>
              {cronograma.length === 0 ? (
                <Text style={styles.modalSubtitle}>
                  Aún no hay actividades publicadas en el cronograma.
                </Text>
              ) : (
                <View>
                  {cronograma.map((act, index) => (
                    <FilaCronograma
                      key={act.id}
                      actividad={act}
                      esUltimo={index === cronograma.length - 1}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAyudaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAyudaVisible(false);
          setMostrarManual(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ayuda y soporte</Text>
              <Pressable
                onPress={() => {
                  setAyudaVisible(false);
                  setMostrarManual(false);
                }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={theme.textoSecundario}
                />
              </Pressable>
            </View>
            <SizedBox height={14} />
            <Pressable
              style={styles.ayudaOpcion}
              onPress={() => setMostrarManual((v) => !v)}
            >
              <Ionicons
                name="help-circle-outline"
                size={18}
                color={theme.morado}
              />
              <Text style={styles.ayudaOpcionTexto}>Manual de usuario</Text>
              <Ionicons
                name={mostrarManual ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textoSecundario}
              />
            </Pressable>
            {mostrarManual && (
              <View style={styles.manualBox}>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Mi proceso</Text> ves
                  tu folio, sede y el resultado de tu examen.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Documentos</Text>{" "}
                  están la guía de estudio y los materiales para prepararte.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Notificaciones</Text>{" "}
                  se avisa cuando cambia tu estado o hay novedades.
                </Text>
                <Text style={styles.manualItem}>
                  • En{" "}
                  <Text style={styles.manualNegrita}>
                    Diagrama de actividades
                  </Text>{" "}
                  está el cronograma completo del proceso de admisión.
                </Text>
                <Text style={styles.manualItem}>
                  • En <Text style={styles.manualNegrita}>Ajustes</Text> activas
                  notificaciones push, modo oscuro y cierras sesión.
                </Text>
              </View>
            )}
            <View style={styles.ayudaSeparador} />
            <Pressable
              style={styles.ayudaOpcion}
              onPress={() => {
                setAyudaVisible(false);
                setMostrarManual(false);
                Linking.openURL("mailto:soporte@admisiones.edu.mx");
              }}
            >
              <Ionicons
                name="mail-open-outline"
                size={18}
                color={theme.morado}
              />
              <Text style={styles.ayudaOpcionTexto}>Contactar soporte</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.textoSecundario}
              />
            </Pressable>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const ModalEditar = ({ visible, onClose, aspirante, onSave }: any) => {
  const [nombre, setNombre] = useState(aspirante.nombre);
  const [correo, setCorreo] = useState(aspirante.correo);

  useEffect(() => {
    const id = setTimeout(() => {
      setNombre(aspirante.nombre);
      setCorreo(aspirante.correo);
    }, 0);
    return () => clearTimeout(id);
  }, [aspirante]);

  const handleSave = () => {
    onSave({ nombre, correo });
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
          <View style={{ alignItems: "center" }}>
            <Avatar aspirante={{ ...aspirante, nombre }} size={56} />
          </View>
          <SizedBox height={14} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Actualizar datos</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.gris} />
            </Pressable>
          </View>
          <Text style={styles.modalSubtitle}>
            El folio y la carrera no se pueden modificar.
          </Text>
          <SizedBox height={20} />
          <CampoTextoModal
            etiqueta="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
          />
          <SizedBox height={12} />
          <CampoTextoModal
            etiqueta="Correo electrónico"
            value={correo}
            onChangeText={setCorreo}
          />
          <SizedBox height={22} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text style={{ color: theme.textoSecundario, fontWeight: "600" }}>
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSave]}
              onPress={handleSave}
            >
              <Text style={{ color: theme.blanco, fontWeight: "bold" }}>
                Guardar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const CampoTextoModal = ({ etiqueta, ...props }: any) => (
  <View>
    <Text style={styles.modalInputLabel}>{etiqueta.toUpperCase()}</Text>
    <SizedBox height={6} />
    <TextInput
      style={styles.modalInput}
      placeholderTextColor={theme.textoTerciario}
      {...props}
    />
  </View>
);

const ModalQR = ({ visible, onClose, aspirante }: any) => {
  const qrPayload = `${aspirante.folio}|${aspirante.correo}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}&bgcolor=ffffff&color=5b21b6&margin=12`;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalContainer,
            { maxWidth: 340, alignItems: "center" },
          ]}
        >
          <Pressable style={{ alignSelf: "flex-end" }} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.gris} />
          </Pressable>
          <SizedBox height={4} />
          <Text style={styles.modalTitle}>Pase de ingreso</Text>
          <Text style={styles.modalSubtitle}>
            Preséntalo el día del examen en la sede
          </Text>
          <SizedBox height={22} />
          <View style={styles.qrCodeWrapper}>
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 160, height: 160 }}
            />
          </View>
          <SizedBox height={18} />
          <Text style={styles.qrFolio}>{aspirante.folio}</Text>
          <SizedBox height={4} />
          <Text style={styles.qrNombre}>{aspirante.nombre}</Text>
          <SizedBox height={22} />
          <Pressable style={{ width: "100%" }} onPress={onClose}>
            <Text
              style={{
                color: theme.textoSecundario,
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Cerrar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// --- ESTILOS ---

const styles = StyleSheet.create({
  appShell: { flex: 1, flexDirection: "row", backgroundColor: theme.bgApp },
  mainColumn: { flex: 1, position: "relative" },

  // Sidebar
  sidebar: {
    width: 250,
    backgroundColor: theme.sidebarBg,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sidebarCollapsed: { width: 76, alignItems: "center", paddingHorizontal: 0 },
  sidebarLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  sidebarLogoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.morado,
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarLogoTitle: { color: theme.blanco, fontWeight: "800", fontSize: 14 },
  sidebarLogoSubtitle: { color: theme.sidebarTexto, fontSize: 10 },
  sidebarNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  sidebarNavItemActivo: { backgroundColor: theme.morado },
  sidebarNavText: {
    color: theme.sidebarTexto,
    fontSize: 13,
    marginLeft: 12,
    fontWeight: "600",
  },
  // Punto rojo sobre el ícono (se ve cuando el sidebar está colapsado).
  sidebarBadge: {
    position: "absolute",
    top: -3,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.rojo,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  // Pastilla con número al lado del texto (sidebar expandido / drawer).
  sidebarBadgePill: {
    marginLeft: "auto",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.rojo,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  sidebarBadgeTexto: {
    color: theme.blanco,
    fontSize: 10,
    fontWeight: "700",
  },

  floatingMenuButton: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.blanco,
    borderWidth: 1,
    borderColor: theme.borde,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },

  // Contenido
  scrollContent: { padding: 20, paddingBottom: 48 },
  contentContainer: { maxWidth: 980, width: "100%", alignSelf: "center" },

  profileHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: 14,
    backgroundColor: theme.blanco,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.borde,
  },
  headerTitle: { fontSize: 19, fontWeight: "800", color: theme.texto },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
    color: theme.textoSecundario,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  statusBadgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "bold", letterSpacing: 0.4 },
  profileHeaderActions: { flexDirection: "row", marginLeft: "auto" },
  botonPrimario: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.morado,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  textoBotonPrimario: {
    color: theme.blanco,
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 6,
  },
  botonSecundario: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.blanco,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: theme.borde,
  },
  textoBotonSecundario: {
    color: theme.texto,
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 6,
  },

  gridRow: { flexDirection: "row", gap: 16 },
  gridColMain: { flex: 1.6 },
  gridColSide: { flex: 1 },
  gridColFull: { flex: undefined, width: "100%", marginTop: 16 },

  cardContainer: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: theme.blanco,
    borderWidth: 1,
    borderColor: theme.borde,
  },
  labelSeccion: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  textoLabelSeccion: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.morado,
    letterSpacing: 1.2,
  },

  datosGrid: { flexDirection: "row", flexWrap: "wrap" },
  campoContainer: { paddingVertical: 10, width: "50%", paddingRight: 10 },
  campoEtiqueta: {
    fontSize: 10,
    color: theme.textoTerciario,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  campoValor: { fontSize: 14, fontWeight: "700" },

  carreraIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: theme.tealFondo,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  carreraNombre: { color: theme.morado, fontSize: 15, fontWeight: "800" },

  examenStatusBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  examenIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  examenStatusTitle: { fontWeight: "bold", fontSize: 14 },
  examenStatusDesc: {
    fontSize: 12,
    color: theme.textoSecundario,
    lineHeight: 17,
  },
  botonExamen: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  botonGuia: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    backgroundColor: theme.morado,
    borderRadius: 12,
  },
  textoBotonGuia: {
    fontSize: 13,
    color: theme.blanco,
    fontWeight: "700",
    marginLeft: 6,
  },

  materialItem: {
    backgroundColor: theme.moradoFondo + "55",
    borderRadius: 12,
    padding: 10,
  },
  materialImagenPreview: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: "#00000010",
  },
  botonVerMaterial: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.morado,
    alignItems: "center",
    justifyContent: "center",
  },

  procesoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },

  botonCerrarSesion: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    padding: 8,
  },
  textoCerrarSesion: { color: theme.gris, fontSize: 12, marginLeft: 6 },

  scoreText: { fontSize: 34, fontWeight: "800" },
  scoreLabel: { fontSize: 11, color: theme.textoTerciario },
  scoreMessage: { fontSize: 13, fontWeight: "bold", textAlign: "center" },
  aciertosText: { fontSize: 12, color: theme.textoSecundario },
  statMiniContainer: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: theme.fondoSuave,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.borde,
    alignItems: "center",
  },
  statMiniValor: { fontSize: 20, fontWeight: "800" },
  statMiniEtiqueta: { fontSize: 10, color: theme.textoSecundario },

  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,13,23,0.55)",
    flexDirection: "row",
  },
  drawerPanel: {
    width: 270,
    height: "100%",
    backgroundColor: theme.sidebarBg,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(23,19,31,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    borderRadius: 24,
    backgroundColor: theme.blanco,
    padding: 22,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.borde,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontWeight: "bold", fontSize: 16, color: theme.texto },
  modalSubtitle: {
    fontSize: 12,
    color: theme.textoSecundario,
    marginTop: 4,
    textAlign: "center",
  },
  ayudaOpcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
  ayudaOpcionTexto: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: theme.texto,
  },
  ayudaSeparador: { height: 1, backgroundColor: theme.borde },
  manualBox: {
    backgroundColor: theme.moradoFondo,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 6,
    gap: 8,
  },
  manualItem: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.texto,
  },
  manualNegrita: { fontWeight: "700" },
  modalInputLabel: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.6,
    color: theme.textoTerciario,
  },
  modalInput: {
    color: theme.texto,
    fontSize: 14,
    backgroundColor: theme.fondoSuave,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borde,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonCancel: { borderWidth: 1, borderColor: theme.borde },
  modalButtonSave: { backgroundColor: theme.morado },
  qrCodeWrapper: {
    padding: 12,
    backgroundColor: theme.blanco,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borde,
    alignSelf: "center",
  },
  qrFolio: {
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 1.4,
    color: theme.morado,
  },
  qrNombre: { fontSize: 13, color: theme.textoSecundario, textAlign: "center" },

  // Cronograma
  actividadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  actividadTimeline: { alignItems: "center", marginRight: 12 },
  actividadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.blanco,
  },
  actividadLine: { flex: 1, width: 2, backgroundColor: theme.borde },
  actividadContent: { flex: 1, paddingTop: 0 },
  actividadTitulo: { fontSize: 13, fontWeight: "700", color: theme.texto },
  actividadFecha: { fontSize: 11, color: theme.textoSecundario, marginTop: 2 },
  actividadDescripcion: {
    fontSize: 12,
    color: theme.textoSecundario,
    marginTop: 4,
  },
  actividadIconoCircle: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actividadTituloRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  actividadBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  actividadBadgeTexto: { fontSize: 9.5, fontWeight: "700" },
});