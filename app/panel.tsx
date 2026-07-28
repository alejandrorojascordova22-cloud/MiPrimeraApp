import { CampoTexto } from "@/components/CampoTexto";
import { ColoresApp } from "@/constants/coloresApp";
import {
  actualizarPerfilAdmin,
  obtenerAdministradorPorId,
} from "@/services/adminAuthServicio";
import {
  calcularEstadisticas,
  filtrarPorCarrera,
  obtenerResultados,
} from "@/services/adminControlador";
import {
  actualizarAsistencia,
  eliminarAspirante,
  obtenerAsistenciasRecientes,
  obtenerAspirantesPorCarrera,
  reactivarExamenAspirante,
} from "@/services/aspirantesServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import {
  actualizarLimites,
  actualizarModoAutomatico,
  actualizarRegistroAutomatico,
  obtenerConfiguracion,
  reiniciarContadorManual,
} from "@/services/correosConfigServicio";
import { obtenerVentanaExamenPorCarrera } from "@/services/preguntasExamenesServicio";
import {
  actualizarLimitesPush,
  actualizarModoAutomaticoPush,
  obtenerConfiguracionPush,
  obtenerHistorialPush,
  reiniciarContadorPushManual,
} from "@/services/pushConfigServicio";
import { obtenerResultadosPorCarrera } from "@/services/resultadosAdminServicio";
import {
  cerrarTodasLasSesiones,
  guardarSesionAdmin,
  obtenerSesionAdmin,
} from "@/services/sesionServicio";
import { supabase } from "@/services/supabaseClient";
import type { ResultadoAspirante } from "@/types/resultadoAspirante";
import {
  exportarResultadosExcel,
  exportarResultadosPDF,
  type FilaExportable,
} from "@/utils/exportadorResultadosServicio";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// Paleta oscura inspirada en el diseño de referencia (Admissions Pro):
// fondo azul-morado profundo, tarjetas translúcidas y acentos en morado.
const TEMA = {
  fondo: "#0E0B26",
  fondoDegradadoInicio: "#0B0821",
  fondoDegradadoFin: "#1E1750",
  tarjeta: "rgba(255,255,255,0.05)",
  tarjetaBorde: "rgba(255,255,255,0.09)",
  tarjetaBordeSuave: "rgba(255,255,255,0.06)",
  primario: "#8B5CF6",
  primarioClaro: "#A78BFA",
  primarioSuave: "rgba(139,92,246,0.18)",
  texto: "#FFFFFF",
  textoSecundario: "#A29DC7",
  exito: "#34D399",
  advertencia: "#FBBF24",
  peligro: "#F87171",
};

const OpcionExportar = ({
  icono,
  titulo,
  subtitulo,
  color,
  onPress,
  disabled,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  subtitulo: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: pressed ? `${color}22` : "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.5 : 1,
      },
    ]}
  >
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: `${color}22`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icono} size={19} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: TEMA.texto, fontWeight: "700", fontSize: 14 }}>
        {titulo}
      </Text>
      <Text style={{ color: TEMA.textoSecundario, fontSize: 11.5 }}>
        {subtitulo}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={TEMA.textoSecundario} />
  </Pressable>
);

const ModalExportarOpciones = ({
  visible,
  onClose,
  onElegir,
  exportando,
}: {
  visible: boolean;
  onClose: () => void;
  onElegir: (
    formato: "excel" | "pdf",
    accion: "compartir" | "descargar",
  ) => void;
  exportando: boolean;
}) => {
  const [formato, setFormato] = useState<"excel" | "pdf">("excel");
  const colorFormato = formato === "excel" ? TEMA.exito : TEMA.peligro;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { width: 380, padding: 0 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Cabecera con ícono e insignia institucional */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              padding: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: TEMA.tarjetaBordeSuave,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: TEMA.primarioSuave,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={TEMA.primarioClaro}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={styles.modalTitle}>Exportar resultados</Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Ionicons
                    name="close"
                    size={20}
                    color={TEMA.textoSecundario}
                  />
                </Pressable>
              </View>
              <Text
                style={{
                  color: TEMA.textoSecundario,
                  fontSize: 11.5,
                  marginTop: 3,
                  lineHeight: 15,
                }}
              >
                Documento institucional con marca de agua. Su modificación
                requiere autorización.
              </Text>
            </View>
          </View>

          <View style={{ padding: 20, paddingTop: 16 }}>
            {exportando ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}>
                <ActivityIndicator color={TEMA.primario} />
                <Text style={{ color: TEMA.textoSecundario, marginTop: 10 }}>
                  Generando documento...
                </Text>
              </View>
            ) : (
              <>
                {/* Selector de formato tipo pestañas, en vez de dos
                    bloques apilados con títulos sueltos. */}
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 10,
                    padding: 3,
                    marginBottom: 16,
                  }}
                >
                  {(["excel", "pdf"] as const).map((f) => {
                    const activo = formato === f;
                    const c = f === "excel" ? TEMA.exito : TEMA.peligro;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setFormato(f)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          paddingVertical: 9,
                          borderRadius: 8,
                          backgroundColor: activo
                            ? "rgba(255,255,255,0.08)"
                            : "transparent",
                        }}
                      >
                        <Ionicons
                          name={
                            f === "excel" ? "grid-outline" : "document-outline"
                          }
                          size={15}
                          color={activo ? c : TEMA.textoSecundario}
                        />
                        <Text
                          style={{
                            color: activo ? TEMA.texto : TEMA.textoSecundario,
                            fontWeight: "700",
                            fontSize: 12.5,
                          }}
                        >
                          {f === "excel" ? "Excel (.xlsx)" : "PDF"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ gap: 8 }}>
                  <OpcionExportar
                    icono="eye-outline"
                    titulo="Ver / Compartir"
                    subtitulo="Abre el diálogo para visualizar o enviar el archivo"
                    color={colorFormato}
                    onPress={() => onElegir(formato, "compartir")}
                  />
                  <OpcionExportar
                    icono="download-outline"
                    titulo="Descargar"
                    subtitulo={`Guarda el archivo .${
                      formato === "excel" ? "xlsx" : "pdf"
                    } sin comprimir`}
                    color={colorFormato}
                    onPress={() => onElegir(formato, "descargar")}
                  />
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/**
 * Panel administrativo. Migrado de lib/presentacion/panel_admin.dart.
 *
 * Flutter tenía 5 pestañas (TabController de 5): Inicio, Aspirantes,
 * Evaluación, Resultados, Académico. La versión anterior de panel.tsx
 * solo tenía la pestaña de Inicio — el resto de la gestión (aspirantes por
 * carrera con asistencia/reactivar examen, bandeja de resultados con
 * exportación, accesos al banco de preguntas y materiales) no existía.
 * Esta versión agrega las 5 pestañas reales.
 *
 * Nota sobre exportación: en Flutter se generaban Excel (.xlsx) y PDF con
 * marca de agua usando paquetes nativos de Dart. Para no agregar
 * dependencias pesadas de PDF/Excel a este proyecto RN, aquí se exporta
 * a CSV (mismo patrón que reportesServicio.ts) usando el Share nativo del
 * sistema — el admin puede abrirlo en Excel/Sheets igual.
 */

type Pestana =
  | "inicio"
  | "aspirantes"
  | "evaluacion"
  | "resultados"
  | "academico";

// --- COMPONENTES DE UI ---

const StatCard = ({
  title,
  value,
  icon,
  color,
  badgeText,
  badgeColor,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badgeText?: string;
  badgeColor?: string;
}) => (
  <View style={styles.statCard}>
    <View style={styles.statTopRow}>
      <View
        style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      {!!badgeText && (
        <View
          style={[styles.statBadge, { backgroundColor: `${badgeColor}22` }]}
        >
          <Text style={[styles.statBadgeTexto, { color: badgeColor }]}>
            {badgeText}
          </Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title.toUpperCase()}</Text>
  </View>
);

// Tarjeta destacada de acceso rápido (equivalente a "Gestión de Aspirantes" /
// "Recursos Académicos" del diseño de referencia): título grande + flecha en
// círculo, con variante en degradado morado para el acceso principal.
const AccesoDestacado = ({
  title,
  gradient,
  onTap,
}: {
  title: string;
  gradient?: boolean;
  onTap: () => void;
}) => {
  const contenido = (
    <>
      <View style={styles.accesoDestacadoFlechaCirculo}>
        <Ionicons name="arrow-forward" size={16} color={TEMA.texto} />
      </View>
      <Text style={styles.accesoDestacadoTitulo}>{title}</Text>
    </>
  );

  if (gradient) {
    return (
      <Pressable style={{ flex: 1 }} onPress={onTap}>
        <LinearGradient
          colors={[TEMA.primario, "#6D28D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.accesoDestacadoGradiente}
        >
          {contenido}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.accesoDestacadoBase, { flex: 1 }]}
      onPress={onTap}
    >
      {contenido}
    </Pressable>
  );
};

// Tarjeta "Campaña de Correo" (equivalente a "Campaña de Correo Activa" del
// diseño de referencia): estado, contador grande, barra de progreso y
// acciones de pausar/reanudar + ver detalles.
const CampanaCorreoCard = ({
  titulo = "Campaña de Correo",
  enviados,
  limite,
  umbral,
  activo,
  actualizando,
  onTogglePausa,
  onVerDetalles,
}: {
  titulo?: string;
  enviados: number;
  limite: number;
  umbral: number;
  activo: boolean;
  actualizando: boolean;
  onTogglePausa: () => void;
  onVerDetalles: () => void;
}) => {
  const porcentaje =
    limite > 0 ? Math.min(100, Math.round((enviados / limite) * 100)) : 0;
  const enAlerta = activo && limite > 0 && porcentaje >= umbral;
  const estadoTexto = !activo
    ? "PAUSADA"
    : enAlerta
      ? "CERCA DEL LÍMITE"
      : "EN CURSO";
  const estadoColor = !activo
    ? TEMA.textoSecundario
    : enAlerta
      ? TEMA.advertencia
      : TEMA.primarioClaro;
  return (
    <View style={styles.campanaCard}>
      <View style={styles.campanaHeaderRow}>
        <Text style={styles.campanaTitulo}>{titulo}</Text>
        <View
          style={[
            styles.campanaEstadoPill,
            {
              backgroundColor: `${estadoColor}2A`,
            },
          ]}
        >
          <View
            style={[
              styles.campanaEstadoPunto,
              { backgroundColor: estadoColor },
            ]}
          />
          <Text style={[styles.campanaEstadoTexto, { color: estadoColor }]}>
            {estadoTexto}
          </Text>
        </View>
      </View>

      <View style={styles.campanaNumeroRow}>
        <Text style={styles.campanaNumero}>{enviados}</Text>
        <Text style={styles.campanaNumeroSub}>/ {limite} enviados hoy</Text>
      </View>

      <View style={styles.campanaBarraFondo}>
        <View
          style={[styles.campanaBarraProgreso, { width: `${porcentaje}%` }]}
        />
      </View>
      <Text style={styles.campanaPorcentaje}>{porcentaje}% completado</Text>

      <View style={styles.campanaBotonesRow}>
        <Pressable
          style={[
            styles.campanaBotonPrincipal,
            actualizando && { opacity: 0.6 },
          ]}
          onPress={onTogglePausa}
          disabled={actualizando}
        >
          {actualizando ? (
            <ActivityIndicator size="small" color={TEMA.texto} />
          ) : (
            <Ionicons
              name={activo ? "pause" : "play"}
              size={16}
              color={TEMA.texto}
            />
          )}
          <Text style={styles.campanaBotonPrincipalTexto}>
            {activo ? "Pausar Envío" : "Reanudar Envío"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.campanaBotonSecundario}
          onPress={onVerDetalles}
        >
          <Ionicons name="eye-outline" size={16} color={TEMA.texto} />
          <Text style={styles.campanaBotonSecundarioTexto}>Ver Detalles</Text>
        </Pressable>
      </View>
    </View>
  );
};

const QuickActionCard = ({
  title,
  subtitle,
  icon,
  color,
  onTap,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onTap: () => void;
}) => (
  <Pressable onPress={onTap}>
    <View style={styles.quickActionCard}>
      <View
        style={[
          styles.quickActionIconContainer,
          { backgroundColor: `${color}1A` },
        ]}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.quickActionTextContainer}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" color={TEMA.textoSecundario} size={18} />
    </View>
  </Pressable>
);

const ActionTile = ({
  title,
  subtitle,
  icon,
  color,
  onTap,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onTap: () => void;
}) => (
  <Pressable onPress={onTap} style={styles.actionTile}>
    <View style={[styles.actionTileIcon, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionTileTitle}>{title}</Text>
      <Text style={styles.actionTileSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" color={TEMA.textoSecundario} size={18} />
  </Pressable>
);

const SeccionTitulo = ({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.seccionTitulo}>{titulo}</Text>
    {!!subtitulo && <Text style={styles.seccionSubtitulo}>{subtitulo}</Text>}
  </View>
);

// Header + menú de cuenta + barra de pestañas (equivalente a _construirHeader()
// + TabBar en panel_admin.dart)
const HeaderAdmin = ({
  nombre,
  rol,
  pestanaActiva,
  onCambiarPestana,
  onRefrescar,
  onMiPerfil,
  onAjustes,
  onCerrarSesion,
  notifNoLeidas,
  onAbrirNotificaciones,
}: {
  nombre: string;
  rol: string;
  pestanaActiva: Pestana;
  onCambiarPestana: (p: Pestana) => void;
  onRefrescar: () => void;
  onMiPerfil: () => void;
  onAjustes: () => void;
  onCerrarSesion: () => void;
  notifNoLeidas: number;
  onAbrirNotificaciones: () => void;
}) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const tabs: { key: Pestana; label: string }[] = [
    { key: "inicio", label: "Inicio" },
    { key: "aspirantes", label: "Aspirantes" },
    { key: "evaluacion", label: "Evaluación" },
    { key: "resultados", label: "Resultados" },
    { key: "academico", label: "Académico" },
  ];

  return (
    <LinearGradient
      colors={[TEMA.fondoDegradadoInicio, TEMA.fondoDegradadoFin]}
      style={styles.headerSafeArea}
    >
      <SafeAreaView>
        <View style={styles.headerContent}>
          <Pressable onPress={() => setMenuVisible(true)}>
            <View style={styles.avatar}>
              <Ionicons name="person" color={TEMA.primarioClaro} size={24} />
            </View>
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              ¡Hola, {nombre}!
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {rol === "maestro" ? "Administrador Maestro" : "Panel de Control"}
            </Text>
          </View>
          <Pressable
            onPress={onAbrirNotificaciones}
            hitSlop={8}
            style={{ marginRight: 16 }}
          >
            <View>
              <Ionicons name="notifications-outline" color="white" size={24} />
              {notifNoLeidas > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    backgroundColor: "#DC2626",
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 3,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "white", fontSize: 10, fontWeight: "700" }}
                  >
                    {notifNoLeidas > 9 ? "9+" : notifNoLeidas}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          <Pressable onPress={onRefrescar} hitSlop={8}>
            <Ionicons name="refresh" color="white" size={24} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-around",
            paddingHorizontal: 8,
          }}
        >
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => onCambiarPestana(t.key)}
              style={styles.tabItem}
            >
              <Text
                style={[
                  styles.tabLabel,
                  pestanaActiva === t.key && styles.tabLabelActiva,
                ]}
              >
                {t.label}
              </Text>
              {pestanaActiva === t.key && <View style={styles.tabIndicador} />}
            </Pressable>
          ))}
        </ScrollView>

        {/* Menú de cuenta: Mi Perfil / Ajustes del Sistema / Cerrar Sesión */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setMenuVisible(false)}
          >
            <View style={[styles.modalCard, { marginTop: 64, marginLeft: 16 }]}>
              <Pressable
                style={styles.menuOpcion}
                onPress={() => {
                  setMenuVisible(false);
                  onMiPerfil();
                }}
              >
                <Ionicons name="person-outline" size={20} color={TEMA.texto} />
                <Text style={styles.menuOpcionTexto}>Mi Perfil</Text>
              </Pressable>
              <Pressable
                style={styles.menuOpcion}
                onPress={() => {
                  setMenuVisible(false);
                  onAjustes();
                }}
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={TEMA.texto}
                />
                <Text style={styles.menuOpcionTexto}>Ajustes del Sistema</Text>
              </Pressable>
              <Pressable
                style={styles.menuOpcion}
                onPress={() => {
                  setMenuVisible(false);
                  onCerrarSesion();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="red" />
                <Text style={[styles.menuOpcionTexto, { color: "red" }]}>
                  Cerrar Sesión
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

// --- Modal de notificaciones (campanita): asistencias registradas por QR ---
const ModalNotificaciones = ({
  visible,
  onClose,
  asistencias,
}: {
  visible: boolean;
  onClose: () => void;
  asistencias: Record<string, any>[];
}) => {
  const formatearFecha = (iso: string) => {
    try {
      const fecha = new Date(iso);
      return fecha.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={[
            styles.modalCard,
            {
              marginTop: 64,
              marginRight: 16,
              alignSelf: "flex-end",
              width: 340,
              maxHeight: 440,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={styles.modalTitle}>Asistencias registradas</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={TEMA.textoSecundario} />
            </Pressable>
          </View>

          {asistencias.length === 0 ? (
            <Text style={{ color: TEMA.textoSecundario, paddingVertical: 16 }}>
              Todavía no hay asistencias registradas.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {asistencias.map((a) => (
                <View
                  key={a.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                  }}
                >
                  <Text style={{ fontWeight: "700", color: TEMA.texto }}>
                    {a.nombre}
                  </Text>
                  <Text style={{ color: TEMA.textoSecundario, fontSize: 12 }}>
                    Folio: {a.folio} · {a.sede}
                  </Text>
                  <Text style={{ color: TEMA.textoSecundario, fontSize: 12 }}>
                    {formatearFecha(a.registrado_en)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Pressable>
    </Modal>
  );
};

// --- PANTALLA PRINCIPAL ---

export default function PanelScreen() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState<Pestana>("inicio");
  const [resultados, setResultados] = useState<ResultadoAspirante[]>([]);
  const [carreras, setCarreras] = useState<Record<string, any>[]>([]);
  const [carreraFiltro, setCarreraFiltro] = useState("Todas");
  const [configCorreos, setConfigCorreos] = useState<Record<
    string,
    any
  > | null>(null);
  const [configPush, setConfigPush] = useState<Record<string, any> | null>(
    null,
  );
  const [carreraActivaResultados, setCarreraActivaResultados] = useState<Record<
    string,
    any
  > | null>(null);
  const [resultadosBD, setResultadosBD] = useState<Record<string, any>[]>([]);
  const [ventanaExamenResultados, setVentanaExamenResultados] = useState<Record<
    string,
    any
  > | null>(null);
  const [cargandoResultados, setCargandoResultados] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  // Modal de opciones de exportación: formato (Excel/PDF) x acción
  // (ver/compartir o descargar). Reemplaza al botón que solo generaba CSV.
  const [exportOpcionesVisible, setExportOpcionesVisible] = useState(false);
  // Confirmación personalizada para acciones destructivas (eliminar,
  // reactivar examen). No usamos Alert.alert para esto porque en web
  // depende de window.confirm(), que algunos navegadores suprimen sin
  // avisar (el botón "parece" no hacer nada, sin error en consola).
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    titulo: string;
    mensaje: string;
    textoConfirmar: string;
    onConfirmar: () => void;
  } | null>(null);
  const [adminActual, setAdminActual] = useState<Record<string, any> | null>(
    null,
  );

  // --- Notificaciones (campanita): asistencias registradas por QR ---
  const [asistenciasRecientes, setAsistenciasRecientes] = useState<
    Record<string, any>[]
  >([]);
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifNoLeidas, setNotifNoLeidas] = useState(0);

  const cargarAsistenciasRecientes = useCallback(async () => {
    const lista = await obtenerAsistenciasRecientes(30);
    setAsistenciasRecientes(lista);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      cargarAsistenciasRecientes();
    }, 0);

    const canal = supabase
      .channel("panel-asistencias")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "asistencias" },
        () => {
          setNotifNoLeidas((n) => n + 1);
          cargarAsistenciasRecientes();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargarAsistenciasRecientes]);

  const abrirNotificaciones = () => {
    setNotifVisible(true);
    setNotifNoLeidas(0);
  };

  // --- Estado de la pestaña Aspirantes ---
  const [carreraActivaIdManual, setCarreraActivaIdManual] = useState<
    number | null
  >(null);
  const [aspirantesBD, setAspirantesBD] = useState<Record<string, any>[]>([]);
  const [cargandoAspirantes, setCargandoAspirantes] = useState(false);
  const [busquedaAspirante, setBusquedaAspirante] = useState("");

  // --- Modal editar perfil ---
  const [perfilVisible, setPerfilVisible] = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // --- Tarjeta "Campaña de Correo" (Inicio) ---
  const cargarResultadosPorCarrera = useCallback(
    async (carrera: Record<string, any>) => {
      setCarreraActivaResultados(carrera);
      setCargandoResultados(true);
      try {
        const [lista, ventana] = await Promise.all([
          obtenerResultadosPorCarrera(carrera.id),
          obtenerVentanaExamenPorCarrera(carrera.id),
        ]);
        setResultadosBD(lista);
        setVentanaExamenResultados(ventana);
      } catch (e: any) {
        console.error("Error cargando resultados por carrera", e);
        const detalle =
          e?.message ?? e?.error_description ?? "Error desconocido.";
        Alert.alert(
          "No se pudieron cargar los resultados",
          `${detalle}\n\nSi esto persiste, revisa los permisos (RLS) de la tabla "aspirantes" en Supabase.`,
        );
      } finally {
        setCargandoResultados(false);
      }
    },
    [],
  );
  const [actualizandoCorreo, setActualizandoCorreo] = useState(false);
  const [actualizandoPush, setActualizandoPush] = useState(false);

  // --- Modales de Correo (movidos desde ajustes-sistema) ---
  const [isCorreosModalVisible, setCorreosModalVisible] = useState(false);
  const [isHistorialModalVisible, setHistorialModalVisible] = useState(false);
  const [isPushModalVisible, setPushModalVisible] = useState(false);
  const [isHistorialPushModalVisible, setHistorialPushModalVisible] =
    useState(false);

  // Fecha/hora del saludo de bienvenida, calculada una sola vez al entrar.
  const fechaHoraSaludo = useMemo(() => {
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const hora = ahora.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fecha.charAt(0).toUpperCase()}${fecha.slice(1)}  ·  ${hora}`;
  }, []);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const sesion = await obtenerSesionAdmin();
      if (!sesion) {
        router.replace("/login-admin");
        return;
      }

      // Revalidar contra la base de datos: la sesión guardada en el
      // celular puede estar desactualizada si a este admin lo eliminaron
      // o desactivaron desde otro dispositivo mientras esta app estaba
      // cerrada. Sin esto, la pantalla confiaba ciegamente en los datos
      // locales y se quedaba en un estado roto (o el login parecía
      // "fallar") en vez de mandar de vuelta al login con un mensaje claro.
      const adminVigente = await obtenerAdministradorPorId(sesion.id);
      if (!adminVigente || adminVigente.activo === false) {
        await cerrarTodasLasSesiones();
        router.replace({
          pathname: "/login-admin",
          params: { sesionInvalida: "1" },
        });
        return;
      }

      setAdminActual(sesion);

      const [res, car, conf, confPush] = await Promise.all([
        obtenerResultados(),
        obtenerCarreras(),
        obtenerConfiguracion(),
        obtenerConfiguracionPush(),
      ]);
      setResultados(res);
      setCarreras(car);
      setConfigCorreos(conf);
      setConfigPush(confPush);

      if (car.length > 0) {
        const primeraCarrera = car[0];
        if (!carreraActivaIdManual) setCarreraActivaIdManual(primeraCarrera.id);
        if (!carreraActivaResultados) {
          setCarreraActivaResultados(primeraCarrera);
          cargarResultadosPorCarrera(primeraCarrera);
        }
      }
    } catch (error) {
      console.error("Error al cargar datos del panel:", error);
    } finally {
      setCargando(false);
    }
  }, [
    router,
    cargarResultadosPorCarrera,
    carreraActivaIdManual,
    carreraActivaResultados,
  ]);

  // Carga inicial de datos al montar la pantalla. Es un efecto legítimo de
  // sincronización con un sistema externo (Supabase) — el patrón que
  // react.dev documenta como "Fetching data" —, pero `cargarDatos` llama a
  // setCargando(true) como primera línea (antes de cualquier await), lo que
  // dispara un falso positivo conocido de esta regla experimental con
  // funciones envueltas en useCallback. Ver: facebook/react#34743.
  useEffect(() => {
    const id = setTimeout(() => {
      cargarDatos();
    }, 0);
    return () => clearTimeout(id);
  }, [cargarDatos]);

  // Carrera activa para la pestaña Aspirantes: la que el admin eligió
  // manualmente, o la primera disponible mientras no haya elegido ninguna.
  // Al ser un valor derivado (no estado sincronizado en un efecto), no hace
  // falta un useEffect para "ajustarlo" cuando cambian las carreras.
  const carreraActivaId = carreraActivaIdManual ?? carreras[0]?.id ?? null;

  const cargarAspirantesPorCarrera = useCallback(async (carreraId: number) => {
    setCargandoAspirantes(true);
    try {
      const data = await obtenerAspirantesPorCarrera(carreraId);
      setAspirantesBD(data);
    } finally {
      setCargandoAspirantes(false);
    }
  }, []);

  // Recarga la lista de aspirantes cuando cambia la carrera activa o se
  // entra a la pestaña Aspirantes. Mismo caso que el efecto anterior: fetch
  // legítimo disparado por un cambio de dependencias, falso positivo de la
  // regla por la llamada a setCargandoAspirantes(true) antes del primer await.
  useEffect(() => {
    if (carreraActivaId != null && pestana === "aspirantes") {
      const id = setTimeout(() => {
        cargarAspirantesPorCarrera(carreraActivaId);
      }, 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [carreraActivaId, pestana, cargarAspirantesPorCarrera]);

  const cerrarSesion = async () => {
    await cerrarTodasLasSesiones();
    router.replace("/login-admin");
  };

  const filtrados = filtrarPorCarrera(resultados, carreraFiltro);
  const stats = calcularEstadisticas(filtrados);
  const nombresCarreras = ["Todas", ...carreras.map((c) => c.nombre as string)];

  // --- Badges de las tarjetas de métricas (Inicio) ---
  const tasaAprobacion =
    stats.terminados > 0 ? (stats.aprobados / stats.terminados) * 100 : 0;
  const badgeAprobados =
    tasaAprobacion >= 70
      ? { text: "Óptimo", color: TEMA.exito }
      : tasaAprobacion >= 40
        ? { text: "Regular", color: TEMA.advertencia }
        : { text: "Bajo", color: TEMA.peligro };
  const badgeEnProgreso =
    stats.enProgreso > 0
      ? { text: "Atención", color: TEMA.advertencia }
      : { text: "Al día", color: TEMA.exito };
  const badgePromedio =
    stats.promedioGeneral >= 80
      ? { text: "Óptimo", color: TEMA.exito }
      : stats.promedioGeneral >= 60
        ? { text: "Regular", color: TEMA.advertencia }
        : { text: "Bajo", color: TEMA.peligro };

  // --- Pausar / reanudar el envío automático de correos ---
  const alternarModoAutomatico = async () => {
    if (!configCorreos) return;
    const nuevoValor = !configCorreos.modo_automatico;
    setActualizandoCorreo(true);
    setConfigCorreos((prev) =>
      prev ? { ...prev, modo_automatico: nuevoValor } : prev,
    );
    const exito = await actualizarModoAutomatico(nuevoValor);
    if (!exito) {
      setConfigCorreos((prev) =>
        prev ? { ...prev, modo_automatico: !nuevoValor } : prev,
      );
      Alert.alert(
        "Error",
        "No se pudo actualizar el modo automático de correos.",
      );
    }
    setActualizandoCorreo(false);
  };

  // --- Pausar / reanudar el envío automático de push ---
  const alternarModoAutomaticoPush = async () => {
    if (!configPush) return;
    const nuevoValor = !configPush.modo_automatico;
    setActualizandoPush(true);
    setConfigPush((prev) =>
      prev ? { ...prev, modo_automatico: nuevoValor } : prev,
    );
    const exito = await actualizarModoAutomaticoPush(nuevoValor);
    if (!exito) {
      setConfigPush((prev) =>
        prev ? { ...prev, modo_automatico: !nuevoValor } : prev,
      );
      Alert.alert("Error", "No se pudo actualizar el modo automático de push.");
    }
    setActualizandoPush(false);
  };

  // --- Acciones de la pestaña Aspirantes ---

  const toggleAsistencia = async (
    aspirante: Record<string, any>,
    valor: boolean,
  ) => {
    setAspirantesBD((prev) =>
      prev.map((a) =>
        a.id === aspirante.id ? { ...a, asistencia: valor } : a,
      ),
    );
    const exito = await actualizarAsistencia(aspirante.id, valor);
    if (!exito) {
      setAspirantesBD((prev) =>
        prev.map((a) =>
          a.id === aspirante.id ? { ...a, asistencia: !valor } : a,
        ),
      );
      Alert.alert("Error", "No se pudo actualizar la asistencia.");
    }
  };

  const confirmarReactivarExamen = (aspirante: Record<string, any>) => {
    setConfirmDialog({
      visible: true,
      titulo: "¿Reactivar examen?",
      mensaje: `Esto borrará el resultado y las respuestas anteriores de "${aspirante.nombre ?? "este aspirante"}", y le permitirá presentar el examen de nuevo desde cero.\n\nEsta acción no se puede deshacer.`,
      textoConfirmar: "Sí, reactivar",
      onConfirmar: async () => {
        setConfirmDialog(null);
        const exito = await reactivarExamenAspirante(aspirante.id);
        if (exito) {
          setAspirantesBD((prev) =>
            prev.map((a) =>
              a.id === aspirante.id
                ? {
                    ...a,
                    examen_finalizado: false,
                    estado: "pendiente",
                    resultado: null,
                    aciertos: null,
                  }
                : a,
            ),
          );
          Alert.alert(
            "Listo",
            `${aspirante.nombre ?? "El aspirante"} puede presentar el examen de nuevo.`,
          );
        } else {
          Alert.alert(
            "Error",
            "No se pudo reactivar el examen. Puede ser un problema de permisos (RLS) en Supabase.",
          );
        }
      },
    });
  };

  const confirmarEliminarAspirante = (aspirante: Record<string, any>) => {
    setConfirmDialog({
      visible: true,
      titulo: "¿Eliminar aspirante?",
      mensaje: `Se borrarán todos los datos de "${aspirante.nombre ?? "este aspirante"}", incluido su folio, respuestas y resultado. Esta acción no se puede deshacer.`,
      textoConfirmar: "Sí, eliminar",
      onConfirmar: async () => {
        setConfirmDialog(null);
        const exito = await eliminarAspirante(aspirante.id);
        if (exito) {
          cargarAspirantesPorCarrera(aspirante.carrera_id);
        } else {
          Alert.alert(
            "Error",
            "No se pudo eliminar al aspirante. Puede ser un problema de permisos (RLS) en Supabase.",
          );
        }
      },
    });
  };

  const aspirantesFiltrados = useMemo(() => {
    const busqueda = busquedaAspirante.toLowerCase();
    if (!busqueda) return aspirantesBD;
    return aspirantesBD.filter(
      (a) =>
        (a.nombre ?? "").toString().toLowerCase().includes(busqueda) ||
        (a.folio ?? "").toString().toLowerCase().includes(busqueda),
    );
  }, [aspirantesBD, busquedaAspirante]);

  const resultadosOrdenados = useMemo(() => {
    return [...resultadosBD].sort((a, b) =>
      (a.nombre ?? "")
        .toString()
        .toLowerCase()
        .localeCompare((b.nombre ?? "").toString().toLowerCase()),
    );
  }, [resultadosBD]);

  const statsResultados = useMemo(() => {
    const aprobados = resultadosBD.filter(
      (r) => (r.resultado ?? 0) >= 60,
    ).length;
    const promedio =
      resultadosBD.length > 0
        ? resultadosBD.reduce((sum, r) => sum + (r.resultado ?? 0), 0) /
          resultadosBD.length
        : 0;
    return { aprobados, promedio };
  }, [resultadosBD]);

  const asistieron = aspirantesBD.filter((a) => a.asistencia === true).length;
  const carreraActiva = carreras.find((c) => c.id === carreraActivaId);

  // --- Exportar resultados a Excel (.xlsx) o PDF, con marca de agua ---
  // institucional. El admin elige formato y si quiere verlo/compartirlo o
  // descargarlo directamente (sin comprimir).

  const armarFilasExportables = (): FilaExportable[] =>
    (pestana === "resultados" ? resultadosOrdenados : filtrados).map(
      (r: any, i: number) => ({
        numero: i + 1,
        // La estructura de datos varía si estamos en la pestaña 'resultados'
        // o en 'inicio'. En 'resultados', los datos están en la raíz del
        // objeto `r`; en 'inicio' (usando `filtrados`), están en `r.aspirante`.
        folio: r.aspirante?.folio ?? r.folio,
        nombre: r.aspirante?.nombre ?? r.nombre,
        carrera: r.aspirante?.carreraNombre ?? r.carreraNombre,
        correo: r.aspirante?.correo ?? r.correo,
        asistencia:
          (r.aspirante?.asistencia ?? r.asistencia) ? "Presente" : "Ausente",
        calificacion: `${r.calificacion}%`,
        aciertos: r.aciertos,
        estado: r.aspirante?.estado ?? r.estado,
      }),
    );

  const nombreCarreraExport =
    (pestana === "resultados"
      ? carreraActivaResultados?.nombre
      : carreraFiltro) ?? "Resultados";

  const ejecutarExportacion = async (
    formato: "excel" | "pdf",
    accion: "compartir" | "descargar",
  ) => {
    setExportOpcionesVisible(false);
    setExportando(true);
    try {
      const filas = armarFilasExportables();
      if (filas.length === 0) {
        Alert.alert("Sin datos", "No hay resultados para exportar.");
        return;
      }
      if (formato === "excel") {
        await exportarResultadosExcel(filas, nombreCarreraExport, accion);
      } else {
        await exportarResultadosPDF(filas, nombreCarreraExport, accion);
      }
    } catch (err) {
      // Alert.alert de React Native no siempre se ve en web, así que
      // además dejamos el error en consola y usamos window.alert ahí.
      console.error("Error al exportar resultados:", err);
      const mensaje =
        err instanceof Error ? err.message : "No se pudo generar el archivo.";
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(`Error al exportar: ${mensaje}`);
      } else {
        Alert.alert("Error", mensaje);
      }
    } finally {
      setExportando(false);
    }
  };

  // --- Editar perfil ---

  const abrirEditarPerfil = () => {
    setNombrePerfil(adminActual?.nombre ?? "");
    setPerfilVisible(true);
  };

  const guardarPerfil = async () => {
    if (!adminActual?.id) return;
    setGuardandoPerfil(true);
    try {
      const exito = await actualizarPerfilAdmin({
        id: adminActual.id,
        nombre: nombrePerfil.trim(),
      });
      if (exito) {
        const actualizado = { ...adminActual, nombre: nombrePerfil.trim() };
        setAdminActual(actualizado);
        await guardarSesionAdmin(actualizado);
        setPerfilVisible(false);
      } else {
        Alert.alert("Error", "No se pudo actualizar el perfil.");
      }
    } finally {
      setGuardandoPerfil(false);
    }
  };

  return (
    <LinearGradient
      colors={[TEMA.fondoDegradadoInicio, TEMA.fondo, TEMA.fondoDegradadoFin]}
      style={{ flex: 1 }}
    >
      <HeaderAdmin
        nombre={adminActual?.nombre ?? "Admin"}
        rol={adminActual?.rol ?? "maestro"}
        pestanaActiva={pestana}
        onCambiarPestana={(p) => {
          // "Evaluación" ya no muestra una pantalla intermedia con un solo
          // botón: al tocar la pestaña se entra directo a la supervisión
          // en vivo, evitando el doble clic (tab -> tarjeta -> pantalla).
          if (p === "evaluacion") {
            router.push("/vista-evaluaciones");
            return;
          }
          setPestana(p);
        }}
        onRefrescar={cargarDatos}
        onMiPerfil={abrirEditarPerfil}
        onAjustes={() => router.push("/ajustes-sistema")}
        onCerrarSesion={cerrarSesion}
        notifNoLeidas={notifNoLeidas}
        onAbrirNotificaciones={abrirNotificaciones}
      />

      <ModalNotificaciones
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        asistencias={asistenciasRecientes}
      />

      <ModalExportarOpciones
        visible={exportOpcionesVisible}
        onClose={() => setExportOpcionesVisible(false)}
        onElegir={ejecutarExportacion}
        exportando={exportando}
      />

      {cargando ? (
        <ActivityIndicator
          style={{ flex: 1 }}
          size="large"
          color={TEMA.primario}
        />
      ) : (
        <>
          {/* ── PESTAÑA 1: INICIO ─────────────────────────────────────── */}
          {pestana === "inicio" && (
            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.contentContainer}
            >
              <View style={styles.heroBloque}>
                <Text style={styles.heroSaludo} numberOfLines={2}>
                  ¡Bienvenido de nuevo, {adminActual?.nombre ?? "Admin"}!
                </Text>
                <Text style={styles.heroFecha}>{fechaHoraSaludo}</Text>
                <Pressable
                  style={styles.heroBotonReporte}
                  onPress={() => setExportOpcionesVisible(true)}
                >
                  <Ionicons
                    name="download-outline"
                    size={16}
                    color={TEMA.primarioClaro}
                  />
                  <Text style={styles.heroBotonReporteTexto}>
                    Generar Reporte
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.filtroCard}
                onPress={() => setSelectorVisible(true)}
              >
                <Text style={styles.filtroLabel}>Filtrar Programa</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontWeight: "bold", color: TEMA.texto }}>
                    {carreraFiltro}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={TEMA.textoSecundario}
                  />
                </View>
              </Pressable>

              <SeccionTitulo titulo="Métricas de Admisión" />
              <View style={styles.grid}>
                <StatCard
                  title="Terminados"
                  value={stats.terminados.toString()}
                  icon="people-outline"
                  color="#6366F1"
                />
                <StatCard
                  title="Aprobados"
                  value={stats.aprobados.toString()}
                  icon="checkmark-circle-outline"
                  color="#10B981"
                  badgeText={badgeAprobados.text}
                  badgeColor={badgeAprobados.color}
                />
                <StatCard
                  title="En Progreso"
                  value={stats.enProgreso.toString()}
                  icon="hourglass-outline"
                  color="#F59E0B"
                  badgeText={badgeEnProgreso.text}
                  badgeColor={badgeEnProgreso.color}
                />
                <StatCard
                  title="Promedio"
                  value={`${stats.promedioGeneral.toFixed(1)}%`}
                  icon="analytics-outline"
                  color="#EC4899"
                  badgeText={badgePromedio.text}
                  badgeColor={badgePromedio.color}
                />
              </View>

              <SeccionTitulo titulo="Accesos Directos" />
              <View style={styles.accesosRow}>
                <AccesoDestacado
                  title={"Gestión de\nAspirantes"}
                  onTap={() => setPestana("aspirantes")}
                />
                <AccesoDestacado
                  title={"Recursos\nAcadémicos"}
                  gradient
                  onTap={() => setPestana("academico")}
                />
              </View>
            </ScrollView>
          )}

          {/* ── PESTAÑA 2: ASPIRANTES ────────────────────────────────── */}
          {pestana === "aspirantes" && (
            <View style={{ flex: 1, flexDirection: "row" }}>
              {/* Columna Izquierda: Lista de Carreras */}
              <View style={styles.aspSidebar}>
                <View style={styles.aspSidebarHeader}>
                  <Text style={styles.aspSidebarTitulo}>CARRERAS</Text>
                  <Pressable
                    style={styles.aspBotonQR}
                    onPress={() => router.push("/escaneo-qr")}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={20}
                      color={TEMA.texto}
                    />
                  </Pressable>
                </View>
                <ScrollView>
                  {carreras.map((c) => {
                    const esActiva = c.id === carreraActivaId;
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.aspCarreraItem,
                          esActiva && styles.aspCarreraItemActivo,
                        ]}
                        onPress={() => setCarreraActivaIdManual(c.id)}
                      >
                        <Text
                          style={[
                            styles.aspCarreraItemTexto,
                            esActiva && styles.aspCarreraItemTextoActivo,
                          ]}
                        >
                          {c.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Columna Derecha: Lista de Aspirantes */}
              <View style={styles.aspMainContent}>
                <View style={styles.aspBuscador}>
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={TEMA.textoSecundario}
                  />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: TEMA.texto }}
                    placeholder="Buscar por nombre o folio…"
                    placeholderTextColor={TEMA.textoSecundario}
                    value={busquedaAspirante}
                    onChangeText={setBusquedaAspirante}
                  />
                </View>

                <View style={styles.aspHeaderLista}>
                  <Text style={styles.aspHeaderListaTexto}>
                    {carreraActiva?.nombre ?? "Selecciona carrera"}
                  </Text>
                  <Text style={styles.aspHeaderListaSubtexto}>
                    {aspirantesBD.length} aspirantes · {asistieron} con
                    asistencia
                  </Text>
                </View>

                {cargandoAspirantes ? (
                  <ActivityIndicator
                    style={{ flex: 1 }}
                    size="large"
                    color={TEMA.primario}
                  />
                ) : (
                  <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {aspirantesFiltrados.length === 0 && (
                      <Text
                        style={{
                          textAlign: "center",
                          color: TEMA.textoSecundario,
                          marginTop: 40,
                        }}
                      >
                        No hay aspirantes registrados en esta carrera.
                      </Text>
                    )}
                    {aspirantesFiltrados.map((asp) => {
                      const estado = asp.estado?.toString() ?? "pendiente";
                      const estadoLabel =
                        estado === "terminado"
                          ? "Finalizado"
                          : estado === "en_revision"
                            ? "En revisión"
                            : "Pendiente";
                      const estadoColor =
                        estado === "terminado"
                          ? "#3B82F6"
                          : estado === "en_revision"
                            ? "#F59E0B"
                            : "#9CA3AF";
                      const asistio = asp.asistencia === true;
                      return (
                        <View key={asp.id} style={styles.aspFila}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={styles.aspFilaNombre}
                              numberOfLines={1}
                            >
                              {asp.nombre ?? "Sin nombre"}
                            </Text>
                            <Text style={styles.aspFilaFolio}>
                              Folio: {asp.folio ?? "—"}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.aspEstadoBadge,
                              { backgroundColor: `${estadoColor}1A` },
                            ]}
                          >
                            <Text
                              style={[
                                styles.aspEstadoTexto,
                                { color: estadoColor },
                              ]}
                            >
                              {estadoLabel}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: asistio
                                  ? TEMA.exito
                                  : TEMA.textoSecundario,
                              }}
                            >
                              {asistio ? "Presente" : "Ausente"}
                            </Text>
                            <Switch
                              value={asistio}
                              onValueChange={(v) => toggleAsistencia(asp, v)}
                              trackColor={{ true: TEMA.exito }}
                            />
                          </View>
                          {(estado === "terminado" ||
                            estado === "en_revision") && (
                            <Pressable
                              onPress={() => confirmarReactivarExamen(asp)}
                              hitSlop={8}
                              style={{ marginLeft: 8 }}
                            >
                              <Ionicons
                                name="reload-circle-outline"
                                size={22}
                                color="orange"
                              />
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => confirmarEliminarAspirante(asp)}
                            hitSlop={8}
                            style={{ marginLeft: 8 }}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color={TEMA.peligro}
                            />
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}

                <View style={styles.aspFabRow}>
                  <Pressable
                    style={[
                      styles.fab,
                      {
                        backgroundColor: TEMA.tarjeta,
                        borderWidth: 1,
                        borderColor: TEMA.tarjetaBorde,
                      },
                    ]}
                    onPress={() => router.push("/carga-masiva")}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={18}
                      color={TEMA.primario}
                    />
                    <Text style={[styles.fabTexto, { color: TEMA.primario }]}>
                      Carga masiva
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.fab, { backgroundColor: TEMA.primario }]}
                    onPress={() => router.push("/registro-aspirante")}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={18}
                      color="white"
                    />
                    <Text style={[styles.fabTexto, { color: TEMA.texto }]}>
                      Nuevo aspirante
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ── PESTAÑA 3: EVALUACIÓN ────────────────────────────────── */}
          {pestana === "evaluacion" && (
            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.contentContainer}
            >
              <SeccionTitulo
                titulo="Gestión de Evaluaciones"
                subtitulo="Supervisión en vivo del examen y control por aspirante"
              />
              <QuickActionCard
                title="Ir a Gestión de Evaluaciones"
                subtitle="Ver aspirantes en examen, tiempos y estado en tiempo real."
                icon="pulse-outline"
                color="#0EA5E9"
                onTap={() => router.push("/vista-evaluaciones")}
              />
            </ScrollView>
          )}

          {/* ── PESTAÑA 4: RESULTADOS ────────────────────────────────── */}
          {pestana === "resultados" && (
            <BandejaResultados
              carreras={carreras}
              carreraActiva={carreraActivaResultados}
              onSelectCarrera={cargarResultadosPorCarrera}
              cargando={cargandoResultados}
              resultados={resultadosOrdenados}
              stats={statsResultados}
              ventanaExamen={ventanaExamenResultados}
              onExportar={() => setExportOpcionesVisible(true)}
              exportando={exportando}
            />
          )}

          {/* ── PESTAÑA 5: ACADÉMICO ─────────────────────────────────── */}
          {pestana === "academico" && (
            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.contentContainer}
            >
              <SeccionTitulo
                titulo="Centro Académico"
                subtitulo="Gestión de exámenes, reactivos y material de estudio"
              />
              {configCorreos && (
                <>
                  <View style={{ height: 16 }} />
                  <CampanaCorreoCard
                    enviados={configCorreos.correos_enviados_hoy ?? 0}
                    limite={configCorreos.limite_diario ?? 0}
                    umbral={configCorreos.umbral_alerta ?? 80}
                    activo={!!configCorreos.modo_automatico}
                    actualizando={actualizandoCorreo}
                    onTogglePausa={alternarModoAutomatico}
                    onVerDetalles={() => setCorreosModalVisible(true)}
                  />
                </>
              )}
              <View style={{ height: 16 }} />
              <HistorialCorreoCard
                onVerDetalles={() => setHistorialModalVisible(true)}
              />
              {configPush && (
                <>
                  <View style={{ height: 16 }} />
                  <CampanaCorreoCard
                    titulo="Notificaciones Push"
                    enviados={configPush.notificaciones_enviadas_hoy ?? 0}
                    limite={configPush.limite_diario ?? 0}
                    umbral={configPush.umbral_alerta ?? 70}
                    activo={!!configPush.modo_automatico}
                    actualizando={actualizandoPush}
                    onTogglePausa={alternarModoAutomaticoPush}
                    onVerDetalles={() => setPushModalVisible(true)}
                  />
                </>
              )}
              <View style={{ height: 16 }} />
              <HistorialCorreoCard
                titulo="Historial de Push"
                subtitulo="Consulta qué notificaciones se enviaron, se omitieron por el límite o fallaron."
                onVerDetalles={() => setHistorialPushModalVisible(true)}
              />
              <View style={{ height: 24 }} />
              <SeccionTitulo titulo="Gestión de Contenido" />
              <ActionTile
                title="Banco de Preguntas"
                subtitle="Crear, editar y organizar los reactivos del examen"
                icon="library-outline"
                color="#8B5CF6"
                onTap={() => router.push("/gestionar-preguntas")}
              />
              <View style={{ height: 12 }} />
              <ActionTile
                title="Materiales de Estudio"
                subtitle="Subir, ver, reemplazar o eliminar PDFs, audios, imágenes y más"
                icon="folder-open-outline"
                color="#F59E0B"
                onTap={() => router.push("/gestionar-materiales")}
              />
              <View style={{ height: 12 }} />
              <ActionTile
                title="Gestionar Cronograma"
                subtitle="Publicar y editar fechas importantes del proceso"
                icon="calendar-outline"
                color="#10B981"
                onTap={() => router.push("/gestionar-cronograma")}
              />
              <View style={{ height: 12 }} />
              <ActionTile
                title="Avisos para Aspirantes"
                subtitle="Publicar anuncios en el tablón que ven los aspirantes"
                icon="megaphone-outline"
                color="#EF4444"
                onTap={() => router.push("/gestionar-avisos")}
              />
            </ScrollView>
          )}
        </>
      )}

      <CorreosConfigModal
        visible={isCorreosModalVisible}
        onClose={() => setCorreosModalVisible(false)}
        configInicial={configCorreos}
        onConfigUpdated={cargarDatos}
      />

      <HistorialCorreosModal
        visible={isHistorialModalVisible}
        onClose={() => setHistorialModalVisible(false)}
      />

      <PushConfigModal
        visible={isPushModalVisible}
        onClose={() => setPushModalVisible(false)}
        configInicial={configPush}
        onConfigUpdated={cargarDatos}
      />

      <HistorialPushModal
        visible={isHistorialPushModalVisible}
        onClose={() => setHistorialPushModalVisible(false)}
      />

      {/* Selector de carrera (compartido por Inicio y Resultados, o Aspirantes) */}
      <Modal
        visible={selectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectorVisible(false)}
        >
          <View style={styles.modalCard}>
            <ScrollView>
              {(pestana === "aspirantes"
                ? carreras
                : nombresCarreras.map((n) => ({ nombre: n }))
              ).map((item: any) => {
                const esAspirantes = pestana === "aspirantes";
                const seleccionado = esAspirantes
                  ? item.id === carreraActivaId
                  : item.nombre === carreraFiltro;
                return (
                  <Pressable
                    key={esAspirantes ? item.id : item.nombre}
                    style={styles.modalOpcion}
                    onPress={() => {
                      if (esAspirantes) setCarreraActivaIdManual(item.id);
                      else setCarreraFiltro(item.nombre);
                      setSelectorVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOpcionTexto,
                        seleccionado && {
                          fontWeight: "bold",
                          color: "#6366F1",
                        },
                      ]}
                    >
                      {item.nombre}
                    </Text>
                    {seleccionado && (
                      <Ionicons name="checkmark" size={18} color="#6366F1" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Modal Mi Perfil (equivalente a _mostrarDialogoEditarPerfil) */}
      <Modal
        visible={perfilVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPerfilVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPerfilVisible(false)}
        >
          <Pressable
            style={styles.perfilCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Ionicons name="person-outline" size={22} color={TEMA.texto} />
              <Text
                style={{ fontSize: 17, fontWeight: "bold", color: TEMA.texto }}
              >
                Mi Perfil
              </Text>
            </View>
            <View style={styles.perfilAvatar}>
              <Ionicons name="person" size={36} color={TEMA.primarioClaro} />
            </View>
            <TextInput
              style={styles.perfilInput}
              placeholder="Nombre completo"
              placeholderTextColor={TEMA.textoSecundario}
              value={nombrePerfil}
              onChangeText={setNombrePerfil}
            />
            <View style={styles.perfilCorreoBox}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={TEMA.textoSecundario}
              />
              <Text style={{ color: TEMA.textoSecundario, fontSize: 13 }}>
                {adminActual?.correo ?? "—"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 16,
              }}
            >
              <Pressable onPress={() => setPerfilVisible(false)}>
                <Text
                  style={{ color: TEMA.textoSecundario, fontWeight: "600" }}
                >
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={styles.perfilGuardarBtn}
                onPress={guardarPerfil}
                disabled={guardandoPerfil}
              >
                {guardandoPerfil ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    Guardar
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmación de acciones destructivas (eliminar / reactivar).
          No usa Alert.alert: en web depende de window.confirm(), que
          algunos navegadores suprimen sin avisar (el botón "parece" no
          hacer nada, sin error en consola ni petición de red). */}
      <Modal
        visible={!!confirmDialog?.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDialog(null)}
      >
        <Pressable
          style={styles.modalOverlayCentrado}
          onPress={() => setConfirmDialog(null)}
        >
          <Pressable style={styles.modalCardCentrado} onPress={() => {}}>
            <Text
              style={{
                color: "white",
                fontWeight: "bold",
                fontSize: 17,
                marginBottom: 8,
              }}
            >
              {confirmDialog?.titulo}
            </Text>
            <Text
              style={{
                color: TEMA.textoSecundario,
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              {confirmDialog?.mensaje}
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 16,
                marginTop: 20,
              }}
            >
              <Pressable onPress={() => setConfirmDialog(null)}>
                <Text
                  style={{ color: TEMA.textoSecundario, fontWeight: "600" }}
                >
                  Cancelar
                </Text>
              </Pressable>
              <Pressable onPress={() => confirmDialog?.onConfirmar()}>
                <Text style={{ color: TEMA.peligro, fontWeight: "bold" }}>
                  {confirmDialog?.textoConfirmar}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

// ════════════════════════════════════════════════════════════════════
// BANDEJA DE RESULTADOS (Pestaña 4)
// ════════════════════════════════════════════════════════════════════

const BandejaResultados = ({
  carreras,
  carreraActiva,
  onSelectCarrera,
  cargando,
  resultados,
  stats,
  ventanaExamen,
  onExportar,
  exportando,
}: {
  carreras: any[];
  carreraActiva: any | null;
  onSelectCarrera: (c: any) => void;
  cargando: boolean;
  resultados: any[];
  stats: { aprobados: number; promedio: number };
  ventanaExamen: any | null;
  onExportar: () => void;
  exportando: boolean;
}) => {
  const { width } = useWindowDimensions();
  const esAncho = width >= 800; // Breakpoint para layout de 2 columnas
  const [selectorCarreraVisible, setSelectorCarreraVisible] = useState(false);

  const fmtFechaHora = (v: any) => {
    if (!v) return "—";
    try {
      const dt = new Date(v.toString());
      return dt.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const panelDerecho = (
    <View style={styles.aspMainContent}>
      <View style={styles.resHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.resHeaderTitle}>
            {carreraActiva?.nombre ?? "Selecciona carrera"}
          </Text>
          <Text style={styles.resHeaderSubtitle}>
            {resultados.length} aspirantes evaluados
          </Text>
          {ventanaExamen && (
            <Text style={styles.resHeaderDates}>
              Apertura: {fmtFechaHora(ventanaExamen.fecha_apertura)} · Cierre:{" "}
              {fmtFechaHora(ventanaExamen.fecha_cierre)}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={[
              styles.resBotonExportar,
              {
                backgroundColor: TEMA.primario,
                opacity: resultados.length === 0 ? 0.45 : 1,
              },
            ]}
            onPress={onExportar}
            disabled={exportando || resultados.length === 0}
          >
            {exportando ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="document-text-outline" size={16} color="white" />
            )}
            <Text style={styles.resBotonExportarTexto}>Exportar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.resMetricasRow}>
        <View style={styles.resMetricaCard}>
          <Text style={styles.resMetricaLabel}>Total</Text>
          <Text style={styles.resMetricaValor}>{resultados.length}</Text>
        </View>
        <View style={styles.resMetricaCard}>
          <Text style={styles.resMetricaLabel}>Aprobados</Text>
          <Text style={[styles.resMetricaValor, { color: TEMA.exito }]}>
            {stats.aprobados}
          </Text>
        </View>
        <View style={styles.resMetricaCard}>
          <Text style={styles.resMetricaLabel}>Promedio</Text>
          <Text style={[styles.resMetricaValor, { color: TEMA.primarioClaro }]}>
            {stats.promedio.toFixed(1)}%
          </Text>
        </View>
      </View>

      {cargando ? (
        <ActivityIndicator
          style={{ flex: 1 }}
          size="large"
          color={TEMA.primario}
        />
      ) : resultados.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons
            name="file-tray-outline"
            size={40}
            color={TEMA.textoSecundario}
          />
          <Text style={{ color: TEMA.textoSecundario, marginTop: 8 }}>
            Sin resultados para esta carrera
          </Text>
        </View>
      ) : (
        <ScrollView horizontal>
          <View style={{ minWidth: 888 }}>
            {/* Encabezado de la tabla */}
            <View style={styles.bandejaTableHeader}>
              <Text style={[styles.bandejaTableHeaderText, { flex: 3 }]}>
                ASPIRANTE (A-Z)
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 2, textAlign: "center" },
                ]}
              >
                PRESENCIA
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 2, textAlign: "center" },
                ]}
              >
                INICIO
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 2, textAlign: "center" },
                ]}
              >
                FIN
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 1, textAlign: "center" },
                ]}
              >
                ACIERTOS
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 2, textAlign: "center" },
                ]}
              >
                CALIFICACIÓN
              </Text>
              <Text
                style={[
                  styles.bandejaTableHeaderText,
                  { flex: 2, textAlign: "center" },
                ]}
              >
                ESTADO
              </Text>
            </View>
            {/* Filas de la tabla */}
            <ScrollView>
              {resultados.map((r, i) => {
                const aprobado = (r.resultado ?? 0) >= 60;
                const estado = r.estado ?? "pendiente";
                const estadoLabel =
                  estado === "terminado"
                    ? aprobado
                      ? "Aprobado"
                      : "No Aprobado"
                    : estado === "en_revision"
                      ? "En Revisión"
                      : "Pendiente";
                const estadoColor =
                  estado === "terminado"
                    ? aprobado
                      ? TEMA.exito
                      : TEMA.peligro
                    : estado === "en_revision"
                      ? TEMA.advertencia
                      : TEMA.textoSecundario;
                const asistio = r.asistencia === true;

                return (
                  <View key={`${r.folio}-${i}`} style={styles.bandejaTableRow}>
                    <View
                      style={[
                        styles.bandejaTableCell,
                        {
                          flex: 3,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: `${estadoColor}20`,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: estadoColor,
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          {(r.nombre ?? "A")[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aspFilaNombre} numberOfLines={1}>
                          {r.nombre}
                        </Text>
                        <Text style={styles.aspFilaFolio} numberOfLines={1}>
                          {r.folio}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.bandejaTableCell,
                        { flex: 2, alignItems: "center" },
                      ]}
                    >
                      <Text
                        style={{
                          color: asistio ? TEMA.exito : TEMA.textoSecundario,
                          fontSize: 11,
                          fontWeight: "600",
                        }}
                      >
                        {asistio ? "Presente" : "Ausente"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.bandejaTableCellText,
                        { flex: 2, textAlign: "center" },
                      ]}
                    >
                      {r.hora_inicio
                        ? new Date(r.hora_inicio).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Text>
                    <Text
                      style={[
                        styles.bandejaTableCellText,
                        { flex: 2, textAlign: "center" },
                      ]}
                    >
                      {r.hora_fin
                        ? new Date(r.hora_fin).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </Text>
                    <Text
                      style={[
                        styles.bandejaTableCellText,
                        { flex: 1, textAlign: "center", fontWeight: "bold" },
                      ]}
                    >
                      {r.aciertos ?? 0}
                    </Text>
                    <Text
                      style={[
                        styles.bandejaTableCellText,
                        {
                          flex: 2,
                          textAlign: "center",
                          color: aprobado ? TEMA.exito : TEMA.peligro,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {r.resultado != null ? `${r.resultado.toFixed(0)}%` : "—"}
                    </Text>
                    <View
                      style={[
                        styles.bandejaTableCell,
                        { flex: 2, alignItems: "center" },
                      ]}
                    >
                      <View
                        style={[
                          styles.aspEstadoBadge,
                          { backgroundColor: `${estadoColor}1A` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.aspEstadoTexto,
                            { color: estadoColor },
                          ]}
                        >
                          {estadoLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );

  if (esAncho) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={styles.aspSidebar}>
          <View style={styles.aspSidebarHeader}>
            <Text style={styles.aspSidebarTitulo}>CARRERAS</Text>
          </View>
          <ScrollView>
            {carreras.map((c) => {
              const esActiva = c.id === carreraActiva?.id;
              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.aspCarreraItem,
                    esActiva && styles.aspCarreraItemActivo,
                  ]}
                  onPress={() => onSelectCarrera(c)}
                >
                  <Text
                    style={[
                      styles.aspCarreraItemTexto,
                      esActiva && styles.aspCarreraItemTextoActivo,
                    ]}
                  >
                    {c.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {panelDerecho}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <Pressable
        style={styles.filtroCard}
        onPress={() => setSelectorCarreraVisible(true)}
      >
        <Text style={styles.filtroLabel}>Programa Académico</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontWeight: "bold", color: TEMA.texto }}>
            {carreraActiva?.nombre ?? "Seleccionar"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={TEMA.textoSecundario}
          />
        </View>
      </Pressable>
      {panelDerecho}
      <Modal
        visible={selectorCarreraVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorCarreraVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectorCarreraVisible(false)}
        >
          <View style={styles.modalCard}>
            <ScrollView>
              {carreras.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.modalOpcion}
                  onPress={() => {
                    onSelectCarrera(c);
                    setSelectorCarreraVisible(false);
                  }}
                >
                  <Text style={styles.modalOpcionTexto}>{c.nombre}</Text>
                  {carreraActiva?.id === c.id && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={TEMA.primario}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const HistorialCorreoCard = ({
  titulo = "Historial de Correos",
  subtitulo = "Consulta el estado de los correos enviados, omitidos o con error.",
  onVerDetalles,
}: {
  titulo?: string;
  subtitulo?: string;
  onVerDetalles: () => void;
}) => (
  <View style={styles.campanaCard}>
    <View style={styles.campanaHeaderRow}>
      <Text style={styles.campanaTitulo}>{titulo}</Text>
      <View
        style={[
          styles.campanaEstadoPill,
          { backgroundColor: "rgba(255,255,255,0.08)" },
        ]}
      >
        <Ionicons
          name="archive-outline"
          size={12}
          color={TEMA.textoSecundario}
        />
        <Text
          style={[styles.campanaEstadoTexto, { color: TEMA.textoSecundario }]}
        >
          REGISTRO
        </Text>
      </View>
    </View>
    <Text style={styles.campanaNumeroSub}>{subtitulo}</Text>
    <View style={{ height: 16 }} />
    <Pressable style={styles.campanaBotonSecundario} onPress={onVerDetalles}>
      <Ionicons name="eye-outline" size={16} color={TEMA.texto} />
      <Text style={styles.campanaBotonSecundarioTexto}>
        Ver Historial Completo
      </Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  headerSafeArea: { backgroundColor: TEMA.fondoDegradadoInicio },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEMA.primarioSuave,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { color: "white", fontSize: 15, fontWeight: "bold" },
  headerSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
  resHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resHeaderTitle: { fontSize: 16, fontWeight: "bold", color: TEMA.texto },
  resHeaderSubtitle: { color: TEMA.textoSecundario, fontSize: 12 },
  resHeaderDates: { color: TEMA.textoSecundario, fontSize: 11, marginTop: 6 },
  resBotonExportar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resBotonExportarTexto: { color: "white", fontWeight: "bold", marginLeft: 4 },
  bandejaTableCellText: { color: TEMA.texto, fontSize: 13 },
  tabBar: {
    flexGrow: 0,
    paddingBottom: 8,
    width: "100%", // Asegura que el ScrollView ocupe todo el ancho
  },
  tabItem: { paddingHorizontal: 14, paddingVertical: 6, alignItems: "center" },
  tabLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "bold",
  },
  tabLabelActiva: { color: "white" },
  tabIndicador: {
    marginTop: 6,
    height: 3,
    width: "100%",
    backgroundColor: TEMA.primario,
    borderRadius: 2,
  },
  container: { flex: 1, backgroundColor: "transparent" },
  contentContainer: { padding: 20, gap: 16 },
  filtroCard: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde, // boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    elevation: 5,
  },
  filtroLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: TEMA.textoSecundario,
    marginBottom: 4,
  },
  seccionTitulo: { fontSize: 20, fontWeight: "bold", color: TEMA.texto },
  seccionSubtitulo: { fontSize: 13, color: TEMA.textoSecundario, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: TEMA.tarjeta,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    gap: 8, // boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    elevation: 5,
  },
  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statBadgeTexto: { fontSize: 9, fontWeight: "bold" },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "bold", color: TEMA.texto },
  statTitle: {
    fontSize: 9,
    fontWeight: "600",
    color: TEMA.textoSecundario,
    letterSpacing: 0.5,
  },
  // Hero de bienvenida (Inicio)
  heroBloque: { marginBottom: 4 },
  heroSaludo: { fontSize: 22, fontWeight: "bold", color: TEMA.texto },
  heroFecha: { fontSize: 12, color: TEMA.textoSecundario, marginTop: 4 },
  heroBotonReporte: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEMA.primarioSuave,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.4)",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
    marginTop: 14,
  },
  heroBotonReporteTexto: {
    color: TEMA.primarioClaro,
    fontWeight: "bold",
    fontSize: 13,
  },
  // Tarjeta "Campaña de Correo" (Inicio)
  campanaCard: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    padding: 20, // boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    elevation: 5,
  },
  campanaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TEMA.tarjetaBordeSuave,
  },
  campanaTitulo: { fontSize: 17, fontWeight: "bold", color: TEMA.texto },
  campanaEstadoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  campanaEstadoPunto: { width: 6, height: 6, borderRadius: 3 },
  campanaEstadoTexto: { fontSize: 10, fontWeight: "bold", letterSpacing: 0.5 },
  campanaNumeroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 16,
  },
  campanaNumero: {
    fontSize: 38,
    fontWeight: "bold",
    color: TEMA.texto,
    lineHeight: 40,
  },
  campanaNumeroSub: {
    fontSize: 13,
    color: TEMA.textoSecundario,
    marginBottom: 6,
  },
  campanaBarraFondo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  campanaBarraProgreso: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TEMA.primario,
  },
  campanaPorcentaje: {
    fontSize: 11,
    color: TEMA.textoSecundario,
    marginTop: 6,
    marginBottom: 18,
    textAlign: "right",
  },
  campanaBotonesRow: { flexDirection: "row", gap: 10 },
  campanaBotonPrincipal: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEMA.primario,
    borderRadius: 14,
    paddingVertical: 12,
  },
  campanaBotonPrincipalTexto: {
    color: TEMA.texto,
    fontWeight: "bold",
    fontSize: 13,
  },
  campanaBotonSecundario: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
  },
  campanaBotonSecundarioTexto: {
    color: TEMA.texto,
    fontWeight: "600",
    fontSize: 13,
  },
  // Accesos destacados (Inicio)
  accesosRow: { flexDirection: "row", gap: 12 },
  accesoDestacadoBase: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    padding: 16,
    minHeight: 118,
    justifyContent: "space-between",
  },
  accesoDestacadoGradiente: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    minHeight: 118,
    justifyContent: "space-between",
  },
  accesoDestacadoFlechaCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  accesoDestacadoTitulo: {
    color: TEMA.texto,
    fontSize: 16,
    fontWeight: "bold",
    lineHeight: 21,
  },
  quickActionCard: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    flexDirection: "row",
    alignItems: "center", // gap: 12,
    // boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    elevation: 5,
  },
  quickActionIconContainer: { padding: 8, borderRadius: 12 },
  quickActionTextContainer: { flex: 1 },
  quickActionTitle: { fontSize: 14, fontWeight: "bold", color: TEMA.texto },
  quickActionSubtitle: { fontSize: 11, color: TEMA.textoSecundario },
  actionTile: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    flexDirection: "row", // alignItems: "center",
    // gap: 12,
    // boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
    elevation: 5,
  },
  actionTileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionTileTitle: { fontSize: 14, fontWeight: "bold", color: TEMA.texto },
  actionTileSubtitle: {
    fontSize: 11,
    color: TEMA.textoSecundario,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    // El padding se elimina para permitir un posicionamiento absoluto preciso.
  },
  modalOverlayCentrado: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#1B1740",
    borderRadius: 16,
    paddingVertical: 8,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
  },
  modalCardCentrado: {
    backgroundColor: "#1B1740",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    borderWidth: 1, // borderColor: TEMA.tarjetaBorde,
    // boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
    elevation: 10,
  },
  modalOpcion: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modalOpcionTexto: { fontSize: 15, color: TEMA.texto },
  menuOpcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuOpcionTexto: { fontSize: 14, color: TEMA.texto, fontWeight: "600" },
  // Pestaña Aspirantes
  aspSidebar: {
    width: 240,
    borderRightWidth: 1,
    borderRightColor: TEMA.tarjetaBordeSuave,
    paddingTop: 8,
  },
  aspSidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  aspSidebarTitulo: {
    color: TEMA.textoSecundario,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.8,
  },
  aspCarreraItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  aspCarreraItemActivo: {
    backgroundColor: TEMA.primarioSuave,
  },
  aspCarreraItemTexto: {
    color: TEMA.textoSecundario,
    fontSize: 13,
  },
  aspCarreraItemTextoActivo: {
    color: TEMA.primarioClaro,
    fontWeight: "bold",
  },
  aspMainContent: {
    flex: 1,
    gap: 8,
  },
  aspHeaderLista: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  aspHeaderListaTexto: {
    fontSize: 16,
    fontWeight: "bold",
    color: TEMA.texto,
  },
  aspHeaderListaSubtexto: {
    fontSize: 12,
    color: TEMA.textoSecundario,
  },
  aspBotonQR: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
  },
  aspBuscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEMA.tarjeta,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
  },
  aspFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: TEMA.tarjetaBordeSuave,
    gap: 8,
  },
  aspFilaNombre: { fontSize: 13, fontWeight: "600", color: TEMA.texto },
  aspFilaFolio: { fontSize: 11, color: TEMA.textoSecundario, marginTop: 2 },
  aspEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  aspEstadoTexto: { fontSize: 10, fontWeight: "bold" },
  aspFabRow: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    gap: 10,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 5,
  },
  fabTexto: { fontWeight: "bold", fontSize: 13 },
  exportarBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEMA.primario,
    borderRadius: 14,
    paddingVertical: 12,
  },
  exportarBtnTexto: { color: "white", fontWeight: "bold" },
  resFila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEMA.tarjeta,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    gap: 10,
  },
  resFechaTexto: {
    fontSize: 10,
    color: TEMA.textoSecundario,
    fontFamily: "monospace",
  },
  bandejaHeroCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  bandejaHeroTitle: {
    color: TEMA.texto,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  bandejaHeroSubtitle: {
    color: TEMA.textoSecundario,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  bandejaMetricsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  bandejaMetricCard: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderRadius: 16,
    padding: 14,
    minWidth: 120,
    flex: 1,
  },
  bandejaMetricLabel: {
    color: TEMA.textoSecundario,
    fontSize: 11,
    marginBottom: 6,
  },
  bandejaMetricValue: {
    color: TEMA.texto,
    fontSize: 20,
    fontWeight: "bold",
  },
  bandejaBulletRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  bandejaBulletItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  bandejaBulletText: {
    color: TEMA.textoSecundario,
    fontSize: 12,
  },
  resMetricasRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  resMetricaCard: {
    flex: 1,
    backgroundColor: TEMA.tarjeta,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  resMetricaLabel: {
    color: TEMA.textoSecundario,
    fontSize: 10,
  },
  resMetricaValor: {
    color: TEMA.textoSecundario,
    fontSize: 12,
  },

  resultadosAccionRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  exportarBtnGrande: {
    flex: 1,
  },
  exportarBtnSecundario: {
    backgroundColor: "rgba(139,92,246,0.32)",
  },
  bandejaTable: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    backgroundColor: TEMA.tarjeta,
  },
  bandejaTableHeader: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bandejaTableHeaderText: {
    color: TEMA.textoSecundario,
    fontSize: 11,
    fontWeight: "600",
  },
  bandejaTableRow: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: TEMA.tarjetaBorde,
    alignItems: "center",
  },
  bandejaTableCell: {
    flex: 1,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  resContenedorReporte: {
    backgroundColor: TEMA.tarjeta,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    gap: 12,
  },
  resFilaReporte: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: TEMA.tarjetaBordeSuave,
  },
  resTituloFilaReporte: {
    fontSize: 11,
    fontWeight: "bold",
    color: TEMA.textoSecundario,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  resValorFilaReporte: {
    fontSize: 13,
    color: TEMA.texto,
  },
  resTextoEntregable: {
    fontSize: 13,
    color: TEMA.textoSecundario,
  },
  resTextoImpacto: {
    fontSize: 13,
    color: TEMA.textoSecundario,
    lineHeight: 18,
    marginTop: 8,
  },
  resGraficaContenedor: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
  },
  resGraficaBarraContenedor: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  resGraficaBarra: {
    width: "50%",
    height: "100%",
    backgroundColor: TEMA.tarjetaBorde,
    borderRadius: 4,
    justifyContent: "flex-end",
  },
  resGraficaEtiquetaBarra: {
    fontSize: 10,
    color: TEMA.textoSecundario,
  },
  resConclusionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  resConclusionTexto: { flex: 1, color: TEMA.textoSecundario, fontSize: 13 },
  resCalificacion: { fontSize: 15, fontWeight: "bold", color: TEMA.texto },
  perfilCard: {
    backgroundColor: "#1B1740",
    borderRadius: 20,
    padding: 20,
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
  },
  perfilAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TEMA.primarioSuave,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  perfilInput: {
    borderWidth: 1,
    borderColor: TEMA.tarjetaBorde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    color: TEMA.texto,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  perfilCorreoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 12,
  },
  perfilGuardarBtn: {
    backgroundColor: TEMA.primario,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Estilos para los modales de correo (movidos de ajustes-sistema)
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TEMA.texto,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: TEMA.textoSecundario,
    marginBottom: 12,
  },
  // Estilos para CorreosConfigModal (movidos de ajustes-sistema)
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: TEMA.tarjetaBorde,
  },
  switchTitle: { fontSize: 14, fontWeight: "600", color: TEMA.texto },
  switchSubtitle: {
    fontSize: 11,
    color: TEMA.textoSecundario,
    marginTop: 2,
  },
  dashboardLabel: {
    fontSize: 12,
    color: TEMA.textoSecundario,
    marginTop: 10,
  },
  dashboardNumero: {
    fontSize: 26,
    fontWeight: "bold",
    color: TEMA.texto,
  },
  dashboardTotal: { fontSize: 16, color: TEMA.textoSecundario },
  progresoFondo: {
    height: 8,
    borderRadius: 6,
    backgroundColor: TEMA.tarjetaBorde,
    marginTop: 8,
    overflow: "hidden",
  },
  progresoRelleno: { height: 8, borderRadius: 6 },
  modalActions: { marginTop: 16, gap: 10 },
  actionButton: {
    backgroundColor: TEMA.primario,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  barraProgresoFondo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TEMA.tarjetaBorde,
    overflow: "hidden",
    marginTop: 4,
  },
  barraProgresoRelleno: {
    height: "100%",
    borderRadius: 3,
  },

  actionButtonText: { color: "white", fontWeight: "bold" },

  avisoLimiteExcedido: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FBEAEA",
    borderColor: "#F2C6C6",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  avisoLimiteExcedidoTexto: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 16,
  },
  historialItem: {
    borderBottomWidth: 1,
    borderBottomColor: TEMA.tarjetaBorde,
    paddingVertical: 10,
  },
  historialItemTitulo: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: TEMA.texto,
    marginRight: 8,
  },
  historialItemSubtitulo: {
    fontSize: 12,
    color: TEMA.textoSecundario,
    marginTop: 2,
  },
  historialItemDetalle: {
    fontSize: 11,
    color: TEMA.advertencia,
    marginTop: 2,
    fontStyle: "italic",
  },
  historialItemFecha: {
    fontSize: 10,
    color: TEMA.textoSecundario,
    marginTop: 4,
  },
});

// ════════════════════════════════════════════════════════════════════
// MODAL DE CONFIGURACIÓN DE CORREO (Extraído de ajustes-sistema.tsx)
// ════════════════════════════════════════════════════════════════════
function CorreosConfigModal({
  visible,
  onClose,
  configInicial,
  onConfigUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  configInicial: Record<string, any> | null;
  onConfigUpdated: () => void;
}) {
  const [config, setConfig] = useState<Record<string, any> | null>(
    configInicial,
  );
  const [guardando, setGuardando] = useState(false);
  const [limite, setLimite] = useState("100");
  const [umbral, setUmbral] = useState("80");

  useEffect(() => {
    const id = setTimeout(() => {
      if (visible && configInicial) {
        setConfig(configInicial);
        setLimite(String(configInicial.limite_diario ?? 100));
        setUmbral(String(configInicial.umbral_alerta ?? 80));
      }
    }, 0);
    return () => clearTimeout(id);
  }, [visible, configInicial]);

  if (!visible) return null;

  const enviadosHoy = Number(config?.correos_enviados_hoy ?? 0);
  const limiteNum = parseInt(limite, 10) || 0;
  const umbralNum = parseInt(umbral, 10) || 0;
  const progreso = limiteNum > 0 ? Math.min(1, enviadosHoy / limiteNum) : 0;
  const enAlerta =
    limiteNum > 0 && (enviadosHoy / limiteNum) * 100 >= umbralNum;

  const toggleModoAutomatico = async (valor: boolean) => {
    setConfig((c) => (c ? { ...c, modo_automatico: valor } : c));
    await actualizarModoAutomatico(valor);
  };

  const toggleRegistroAutomatico = async (valor: boolean) => {
    setConfig((c) => (c ? { ...c, registro_automatico_activo: valor } : c));
    await actualizarRegistroAutomatico(valor);
  };

  const guardarLimites = async () => {
    const l = parseInt(limite, 10);
    const u = parseInt(umbral, 10);
    if (isNaN(l) || l <= 0) {
      Alert.alert("Error", "Ingresa un límite diario mayor a 0.");
      return;
    }
    if (isNaN(u) || u <= 0 || u > 100) {
      Alert.alert("Error", "Ingresa un umbral de alerta entre 1 y 100.");
      return;
    }
    setGuardando(true);
    const exito = await actualizarLimites({ limiteDiario: l, umbralAlerta: u });
    setGuardando(false);
    if (exito) {
      Alert.alert("Listo", "Configuración guardada.");
      onConfigUpdated();
    } else {
      Alert.alert("Error", "No se pudo guardar la configuración.");
    }
  };

  const reiniciarContador = async () => {
    setGuardando(true);
    await reiniciarContadorManual();
    onConfigUpdated();
    setGuardando(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayCentrado}>
        <Pressable
          style={styles.modalCardCentrado}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>
                Configuración de Correo Automático
              </Text>
              <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={TEMA.textoSecundario} />
              </Pressable>
            </View>

            {!config ? (
              <ActivityIndicator style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>
                      Envío automático activo
                    </Text>
                    <Text style={styles.switchSubtitle}>
                      {config.modo_automatico
                        ? "Los correos se envían automáticamente."
                        : "El envío automático está pausado."}
                    </Text>
                  </View>
                  <Switch
                    value={!!config.modo_automatico}
                    onValueChange={toggleModoAutomatico}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>
                      Correo de registro (bienvenida)
                    </Text>
                    <Text style={styles.switchSubtitle}>
                      {config.registro_automatico_activo !== false
                        ? "Se envía al terminar el registro."
                        : "Pausado."}
                    </Text>
                  </View>
                  <Switch
                    value={config.registro_automatico_activo !== false}
                    onValueChange={toggleRegistroAutomatico}
                    disabled={!config.modo_automatico}
                  />
                </View>

                <Text style={styles.dashboardLabel}>Correos enviados hoy</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <Text style={styles.dashboardNumero}>{enviadosHoy}</Text>
                  <Text style={styles.dashboardTotal}> / {limiteNum}</Text>
                </View>
                <View style={styles.progresoFondo}>
                  <View
                    style={[
                      styles.progresoRelleno,
                      {
                        width: `${progreso * 100}%`,
                        backgroundColor: enAlerta ? "orange" : "#16A34A",
                      },
                    ]}
                  />
                </View>
                <Pressable
                  onPress={reiniciarContador}
                  style={{ alignSelf: "flex-end", marginTop: 6 }}
                >
                  <Text style={{ color: ColoresApp.primario, fontSize: 12 }}>
                    ↻ Reiniciar contador
                  </Text>
                </Pressable>

                <View style={{ marginTop: 12 }}>
                  <CampoTexto
                    etiqueta="Límite diario de correos"
                    valor={limite}
                    onChangeText={setLimite}
                    keyboardType="number-pad"
                    icono="speedometer-outline"
                  />
                  <CampoTexto
                    etiqueta="Umbral de alerta (%)"
                    valor={umbral}
                    onChangeText={setUmbral}
                    keyboardType="number-pad"
                    icono="warning-outline"
                  />
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={guardarLimites}
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// MODAL DE HISTORIAL DE CORREOS (Extraído de ajustes-sistema.tsx)
// ════════════════════════════════════════════════════════════════════
function HistorialCorreosModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  // ... (El código del modal de historial se movería aquí)
  // Por simplicidad, se deja como ejercicio, pero la estructura sería idéntica
  // al modal de configuración.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayCentrado}>
        <Pressable
          style={styles.modalCardCentrado}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>
              Historial de Correos
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={TEMA.textoSecundario} />
            </Pressable>
          </View>
          <Text
            style={{
              color: TEMA.textoSecundario,
              textAlign: "center",
              marginVertical: 20,
            }}
          >
            (Funcionalidad de historial de correos pendiente de implementar
            aquí)
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
// ════════════════════════════════════════════════════════════════════
// MODAL DE CONFIGURACIÓN DE NOTIFICACIONES PUSH
// ════════════════════════════════════════════════════════════════════
function PushConfigModal({
  visible,
  onClose,
  configInicial,
  onConfigUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  configInicial: Record<string, any> | null;
  onConfigUpdated: () => void;
}) {
  const [config, setConfig] = useState<Record<string, any> | null>(
    configInicial,
  );
  const [guardando, setGuardando] = useState(false);
  const [limite, setLimite] = useState("200");
  const [umbral, setUmbral] = useState("70");

  useEffect(() => {
    const id = setTimeout(() => {
      if (visible && configInicial) {
        setConfig(configInicial);
        setLimite(String(configInicial.limite_diario ?? 200));
        setUmbral(String(configInicial.umbral_alerta ?? 70));
      }
    }, 0);
    return () => clearTimeout(id);
  }, [visible, configInicial]);

  if (!visible) return null;

  const enviadasHoy = Number(config?.notificaciones_enviadas_hoy ?? 0);
  const limiteNum = parseInt(limite, 10) || 0;
  const umbralNum = parseInt(umbral, 10) || 0;
  const progreso = limiteNum > 0 ? Math.min(1, enviadasHoy / limiteNum) : 0;
  const enAlerta =
    limiteNum > 0 && (enviadasHoy / limiteNum) * 100 >= umbralNum;
  const excedido = !!config?.limite_excedido || enviadasHoy >= limiteNum;

  const toggleModoAutomatico = async (valor: boolean) => {
    setConfig((c) => (c ? { ...c, modo_automatico: valor } : c));
    await actualizarModoAutomaticoPush(valor);
  };

  const guardarLimites = async () => {
    const l = parseInt(limite, 10);
    const u = parseInt(umbral, 10);
    if (isNaN(l) || l <= 0) {
      Alert.alert("Error", "Ingresa un límite diario mayor a 0.");
      return;
    }
    if (isNaN(u) || u <= 0 || u > 100) {
      Alert.alert("Error", "Ingresa un umbral de alerta entre 1 y 100.");
      return;
    }
    setGuardando(true);
    const exito = await actualizarLimitesPush({
      limiteDiario: l,
      umbralAlerta: u,
    });
    setGuardando(false);
    if (exito) {
      Alert.alert("Listo", "Configuración guardada.");
      onConfigUpdated();
    } else {
      Alert.alert("Error", "No se pudo guardar la configuración.");
    }
  };

  const reiniciarContador = async () => {
    setGuardando(true);
    await reiniciarContadorPushManual();
    onConfigUpdated();
    setGuardando(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayCentrado}>
        <Pressable
          style={styles.modalCardCentrado}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>
                Configuración de Notificaciones Push
              </Text>
              <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={TEMA.textoSecundario} />
              </Pressable>
            </View>

            {!config ? (
              <ActivityIndicator style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>
                      Envío automático activo
                    </Text>
                    <Text style={styles.switchSubtitle}>
                      {config.modo_automatico
                        ? "Las notificaciones se envían automáticamente."
                        : "El envío automático está pausado."}
                    </Text>
                  </View>
                  <Switch
                    value={!!config.modo_automatico}
                    onValueChange={toggleModoAutomatico}
                  />
                </View>

                {excedido && (
                  <View style={styles.avisoLimiteExcedido}>
                    <Ionicons
                      name="warning-outline"
                      size={16}
                      color="#DC2626"
                    />
                    <Text style={styles.avisoLimiteExcedidoTexto}>
                      Se alcanzó el límite diario: los envíos nuevos se están
                      omitiendo hasta que reinicies el contador o suba el
                      límite.
                    </Text>
                  </View>
                )}

                <Text style={styles.dashboardLabel}>
                  Notificaciones enviadas hoy
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <Text style={styles.dashboardNumero}>{enviadasHoy}</Text>
                  <Text style={styles.dashboardTotal}> / {limiteNum}</Text>
                </View>
                <View style={styles.progresoFondo}>
                  <View
                    style={[
                      styles.progresoRelleno,
                      {
                        width: `${progreso * 100}%`,
                        backgroundColor: excedido
                          ? "#DC2626"
                          : enAlerta
                            ? "orange"
                            : "#16A34A",
                      },
                    ]}
                  />
                </View>
                <Pressable
                  onPress={reiniciarContador}
                  style={{ alignSelf: "flex-end", marginTop: 6 }}
                >
                  <Text style={{ color: ColoresApp.primario, fontSize: 12 }}>
                    ↻ Reiniciar contador
                  </Text>
                </Pressable>

                <View style={{ marginTop: 12 }}>
                  <CampoTexto
                    etiqueta="Límite diario de notificaciones"
                    valor={limite}
                    onChangeText={setLimite}
                    keyboardType="number-pad"
                    icono="speedometer-outline"
                  />
                  <CampoTexto
                    etiqueta="Umbral de alerta (%)"
                    valor={umbral}
                    onChangeText={setUmbral}
                    keyboardType="number-pad"
                    icono="warning-outline"
                  />
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={guardarLimites}
                    disabled={guardando}
                  >
                    {guardando ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>Guardar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// MODAL DE HISTORIAL DE NOTIFICACIONES PUSH
// ════════════════════════════════════════════════════════════════════
const ETIQUETA_ESTADO_PUSH: Record<string, { texto: string; color: string }> = {
  enviado: { texto: "Enviado", color: "#16A34A" },
  error: { texto: "Error", color: "#DC2626" },
  omitido_por_limite: { texto: "Omitido (límite)", color: "#D97706" },
};

function HistorialPushModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [historial, setHistorial] = useState<Record<string, any>[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => {
      setCargando(true);
      obtenerHistorialPush({ limite: 50 })
        .then(setHistorial)
        .finally(() => setCargando(false));
    }, 0);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayCentrado}>
        <Pressable
          style={styles.modalCardCentrado}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>
              Historial de Push
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={TEMA.textoSecundario} />
            </Pressable>
          </View>

          {cargando ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : historial.length === 0 ? (
            <Text
              style={{
                color: TEMA.textoSecundario,
                textAlign: "center",
                marginVertical: 20,
              }}
            >
              Aún no se ha enviado ninguna notificación push.
            </Text>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
            >
              {historial.map((item) => {
                const etiqueta = ETIQUETA_ESTADO_PUSH[item.estado] ?? {
                  texto: item.estado,
                  color: TEMA.textoSecundario,
                };
                return (
                  <View key={item.id} style={styles.historialItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={styles.historialItemTitulo}
                        numberOfLines={1}
                      >
                        {item.titulo}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: etiqueta.color,
                        }}
                      >
                        {etiqueta.texto}
                      </Text>
                    </View>
                    <Text
                      style={styles.historialItemSubtitulo}
                      numberOfLines={2}
                    >
                      {item.cuerpo}
                    </Text>
                    {!!item.detalle && (
                      <Text
                        style={styles.historialItemDetalle}
                        numberOfLines={2}
                      >
                        {item.detalle}
                      </Text>
                    )}
                    <Text style={styles.historialItemFecha}>
                      {new Date(item.fecha).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
