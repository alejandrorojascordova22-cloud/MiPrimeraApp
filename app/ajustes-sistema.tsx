import { CampoTexto } from "@/components/CampoTexto";
import { ColorPickerCampo } from "@/components/ColorPickerCampo";
import { VistaPreviaTema } from "@/components/VistaPreviaTema";
import { avisar, useConfirm } from "@/components/ConfirmDialog";
import { DeslizadorSimple } from "@/components/DeslizadorSimple";
import { ColoresApp } from "@/constants/coloresApp";
import { useTemaControlador } from "@/hooks/useTemaControlador";
import {
    actualizarActivoAdmin,
    actualizarPerfilAdmin,
    crearAdministrador,
    eliminarAdministrador,
    obtenerAdministradoresSecundarios,
} from "@/services/adminAuthServicio";
import {
    actualizarLimites,
    actualizarLimitesMensuales,
    actualizarModoAutomatico,
    actualizarRegistroAutomatico,
    obtenerConfiguracion,
    obtenerHistorial,
    reiniciarContadorManual,
} from "@/services/correosConfigServicio";
import { reporteACsv } from "@/services/reportesServicio";
import {
    generarReporteAspirantesPeriodo,
    purgarAspirantesPeriodo,
} from "@/services/resultadosAdminServicio";
import {
    cerrarSesionAdmin,
    obtenerSesionAdmin,
} from "@/services/sesionServicio";
import { temaConfigPorDefecto, type TemaConfig } from "@/services/temaConfig";
import {
    listarImagenesFondoRecientes,
    subirImagenFondoTema,
} from "@/services/temaConfigServicio";
import {
    esContraseniaFuerte,
    obtenerFeedbackContrasena,
} from "@/utils/seguridadServicio";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

// --- TIPOS ---
type Admin = {
  id: number;
  nombre: string;
  correo: string;
  rol: "maestro" | "administrador" | "coordinador";
  activo: boolean;
  avatar_url?: string | null;
};

// --- COMPONENTES BASE ---

const SettingsCard = ({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  children: React.ReactNode;
}) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const SettingsTile = ({
  title,
  subtitle,
  icon,
  onTap,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onTap: () => void;
}) => (
  <Pressable onPress={onTap}>
    <View style={styles.tileContainer}>
      <View style={styles.tileIconWrapper}>
        <Ionicons name={icon} size={20} color={ColoresApp.texto} />
      </View>
      <View style={styles.tileTextContainer}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="grey" />
    </View>
  </Pressable>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

/** Fila de opciones tipo "segmented control" reutilizada en varios modales. */
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

export default function PantallaAjustesSistema() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [cargando, setCargando] = useState(true);

  const [isReporteModalVisible, setReporteModalVisible] = useState(false);
  const [isArchivarModalVisible, setArchivarModalVisible] = useState(false);
  const [isAdminsModalVisible, setAdminsModalVisible] = useState(false);
  const [isCorreosModalVisible, setCorreosModalVisible] = useState(false);
  const [isHistorialModalVisible, setHistorialModalVisible] = useState(false);
  const [isAparienciaModalVisible, setAparienciaModalVisible] = useState(false);
  const [isEditarPerfilVisible, setEditarPerfilVisible] = useState(false);

  const cargarSesion = useCallback(async () => {
    setCargando(true);
    const sesion = await obtenerSesionAdmin();
    if (!sesion) {
      router.replace("/login-admin");
      return;
    }
    setAdmin(sesion as Admin);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    Promise.resolve().then(() => cargarSesion());
  }, [cargarSesion]);

  const onDatosActualizados = () => {
    // Aquí es donde, si algún día panel.tsx expone un método compartido
    // (p. ej. mediante Context), se recargarían sus estadísticas tras una
    // purga. Por ahora el panel se refresca solo con su propio useEffect
    // cada vez que se vuelve a esa pantalla.
    console.log(
      "Datos actualizados: el panel se refrescará al volver a abrirse.",
    );
  };

  const cerrarSesion = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres cerrar la sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, cerrar",
          style: "destructive",
          onPress: async () => {
            await cerrarSesionAdmin();
            router.replace("/login-admin");
          },
        },
      ],
    );
  };

  if (cargando || !admin) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={ColoresApp.primario} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Ajustes del Sistema" }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          <Text style={styles.mainTitle}>Configuración</Text>
          <Text style={styles.mainSubtitle}>
            Administra tu perfil, accesos y parámetros del sistema.
          </Text>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={30} color="#6DFE9C" />
              </View>
              <View style={styles.profileTextContainer}>
                <Text style={styles.profileName}>
                  {admin.nombre ?? "Administrador"}
                </Text>
                <Text style={styles.profileEmail}>{admin.correo}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    ⭐{" "}
                    {admin.rol === "maestro"
                      ? "Administrador Maestro"
                      : admin.rol}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setEditarPerfilVisible(true)}
                style={styles.editButton}
              >
                <Ionicons name="create-outline" size={16} color="white" />
                <Text style={styles.editButtonText}>Editar</Text>
              </Pressable>
            </View>
          </View>

          {/* Security Card */}
          <SettingsCard
            title="Seguridad y Personal"
            icon="shield-checkmark-outline"
            color={ColoresApp.primario}
          >
            <SettingsTile
              title="Panel de Administradores"
              subtitle="Controlar accesos y permisos del equipo"
              icon="people-outline"
              onTap={() => setAdminsModalVisible(true)}
            />
          </SettingsCard>

          {/* Data Lifecycle Card */}
          <SettingsCard
            title="Ciclo de Vida de Datos"
            icon="calendar-outline"
            color="green"
          >
            <SettingsTile
              title="Exportar Reportes"
              subtitle="Generar informe por período de admisión"
              icon="download-outline"
              onTap={() => setReporteModalVisible(true)}
            />
            <View style={styles.divider} />
            <SettingsTile
              title="Archivar Aspirantes"
              subtitle="Archivar registros de periodos caducados"
              icon="trash-outline"
              onTap={() => setArchivarModalVisible(true)}
            />
          </SettingsCard>

          {/* Appearance Card */}
          <SettingsCard
            title="Apariencia del Sistema"
            icon="color-palette-outline"
            color="pink"
          >
            <SettingsTile
              title="Colores, fondo y estilo"
              subtitle="Cambia el tema para admins y aspirantes"
              icon="brush-outline"
              onTap={() => setAparienciaModalVisible(true)}
            />
          </SettingsCard>

          {/* System Info Card */}
          <SettingsCard
            title="Información del Sistema"
            icon="information-circle-outline"
            color="grey"
          >
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <InfoRow label="Versión de App" value="1.0.0" />
              <View style={styles.divider} />
              <InfoRow label="Plataforma" value="React Native (Expo)" />
              <View style={styles.divider} />
              <InfoRow label="Entorno" value="Cloud Production" />
              <View style={styles.divider} />
              <InfoRow label="Servicio de Datos" value="Supabase" />
              <View style={styles.divider} />
              <InfoRow label="Estado del Enlace" value="Sincronizado ✅" />
            </View>
          </SettingsCard>

          {/* Logout Button */}
          <Pressable style={styles.logoutButton} onPress={cerrarSesion}>
            <Ionicons name="log-out-outline" color="red" size={18} />
            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
          </Pressable>

          <Text style={styles.footerText}>
            Admisión UT Oriental © 2026 • v1.0.2
          </Text>
        </View>
      </ScrollView>

      <EditarPerfilModal
        visible={isEditarPerfilVisible}
        admin={admin}
        onClose={() => setEditarPerfilVisible(false)}
        onGuardado={(nuevo) => setAdmin(nuevo)}
      />

      <GestionAdminsModal
        visible={isAdminsModalVisible}
        onClose={() => setAdminsModalVisible(false)}
      />

      <ReportePeriodoModal
        visible={isReporteModalVisible}
        onClose={() => setReporteModalVisible(false)}
      />

      <ArchivarPeriodoModal
        visible={isArchivarModalVisible}
        onClose={() => setArchivarModalVisible(false)}
        onDataUpdated={onDatosActualizados}
      />

      <CorreosConfigModal
        visible={isCorreosModalVisible}
        onClose={() => setCorreosModalVisible(false)}
      />

      <HistorialCorreosModal
        visible={isHistorialModalVisible}
        onClose={() => setHistorialModalVisible(false)}
      />

      <AparienciaModal
        visible={isAparienciaModalVisible}
        onClose={() => setAparienciaModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════
// EDITAR PERFIL
// ════════════════════════════════════════════════════════════════════
function EditarPerfilModal({
  visible,
  admin,
  onClose,
  onGuardado,
}: {
  visible: boolean;
  admin: Admin;
  onClose: () => void;
  onGuardado: (a: Admin) => void;
}) {
  const [nombre, setNombre] = useState(admin.nombre ?? "");
  const [avatarUrl, setAvatarUrl] = useState(admin.avatar_url ?? "");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => {
      setNombre(admin.nombre ?? "");
      setAvatarUrl(admin.avatar_url ?? "");
    });
  }, [visible, admin]);

  const guardar = async () => {
    if (nombre.trim().length === 0) {
      Alert.alert("Error", "El nombre no puede estar vacío.");
      return;
    }
    setGuardando(true);
    const exito = await actualizarPerfilAdmin({
      id: admin.id,
      nombre,
      avatarUrl,
    });
    setGuardando(false);
    if (exito) {
      onGuardado({
        ...admin,
        nombre: nombre.trim(),
        avatar_url: avatarUrl.trim() || null,
      });
      onClose();
    } else {
      Alert.alert("Error", "No se pudo actualizar el perfil.");
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
          <Text style={styles.modalTitle}>Editar Perfil</Text>
          <CampoTexto
            etiqueta="Nombre"
            valor={nombre}
            onChangeText={setNombre}
            icono="person-outline"
            placeholder="Tu nombre"
          />
          <CampoTexto
            etiqueta="URL de avatar (opcional)"
            valor={avatarUrl}
            onChangeText={setAvatarUrl}
            icono="image-outline"
            placeholder="https://..."
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={guardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Guardar</Text>
              )}
            </Pressable>
          </View>
          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// PANEL DE ADMINISTRADORES
// ════════════════════════════════════════════════════════════════════
function GestionAdminsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [admins, setAdmins] = useState<Record<string, any>[]>([]);
  const [cargando, setCargando] = useState(false);
  const [isNuevoVisible, setNuevoVisible] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const datos = await obtenerAdministradoresSecundarios();
    setAdmins(datos);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => cargar());
  }, [visible, cargar]);

  const toggleActivo = async (
    adminItem: Record<string, any>,
    valor: boolean,
  ) => {
    const exito = await actualizarActivoAdmin(adminItem.id, valor);
    if (exito) {
      cargar();
    } else {
      console.error("toggleActivo falló para admin id:", adminItem.id);
      avisar("Error", "No se pudo actualizar el acceso.");
    }
  };

  const confirmarEliminar = (adminItem: Record<string, any>) => {
    const ejecutarEliminar = async () => {
      const exito = await eliminarAdministrador(adminItem.id);
      if (exito) {
        cargar();
      } else {
        console.error("eliminarAdministrador falló para id:", adminItem.id);
        avisar("Error", "No se pudo eliminar el administrador.");
      }
    };

    // Alert.alert con botones no muestra ningún diálogo en web (queda en
    // silencio), así que ahí usamos window.confirm en su lugar.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (
        window.confirm(
          `¿Eliminar a ${adminItem.nombre}? Esta acción no se puede deshacer.`,
        )
      ) {
        ejecutarEliminar();
      }
      return;
    }

    Alert.alert(
      "Eliminar administrador",
      `¿Eliminar a ${adminItem.nombre}? Esta acción no se puede deshacer.`,
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContainer, { maxHeight: "85%" }]}>
          <Text style={styles.modalTitle}>Administradores Secundarios</Text>
          <Text style={styles.modalSubtitle}>
            Gestiona los accesos del equipo de admisión.
          </Text>

          <Pressable
            style={[styles.actionButton, { marginTop: 12 }]}
            onPress={() => setNuevoVisible(true)}
          >
            <Text style={styles.actionButtonText}>
              + Agregar nuevo administrador
            </Text>
          </Pressable>

          {cargando ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : admins.length === 0 ? (
            <Text style={styles.emptyText}>
              Sin administradores secundarios. Agrega uno con el botón de
              arriba.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 320, marginTop: 12 }}>
              {admins.map((a) => (
                <View
                  key={a.id}
                  style={[
                    styles.adminRow,
                    !a.activo && styles.adminRowInactivo,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminNombre}>{a.nombre}</Text>
                    <Text style={styles.adminCorreo}>{a.correo}</Text>
                    <Text style={styles.adminRol}>{a.rol}</Text>
                  </View>
                  <Switch
                    value={!!a.activo}
                    onValueChange={(v) => toggleActivo(a, v)}
                  />
                  <Pressable
                    onPress={() => confirmarEliminar(a)}
                    style={{ marginLeft: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="red" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cerrar</Text>
          </Pressable>
        </View>
      </View>

      <NuevoAdminModal
        visible={isNuevoVisible}
        onClose={() => setNuevoVisible(false)}
        onCreado={() => {
          setNuevoVisible(false);
          cargar();
        }}
      />
    </Modal>
  );
}

function NuevoAdminModal({
  visible,
  onClose,
  onCreado,
}: {
  visible: boolean;
  onClose: () => void;
  onCreado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [rol, setRol] = useState<"administrador" | "coordinador">(
    "administrador",
  );
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => {
      setNombre("");
      setCorreo("");
      setContrasena("");
      setRol("administrador");
    });
  }, [visible]);

  const feedback =
    contrasena.length > 0 ? obtenerFeedbackContrasena(contrasena) : "";

  const crear = async () => {
    if (
      nombre.trim() === "" ||
      correo.trim() === "" ||
      contrasena.trim() === ""
    ) {
      avisar("Error", "Completa todos los campos.");
      return;
    }
    if (!esContraseniaFuerte(contrasena)) {
      avisar("Contraseña débil", obtenerFeedbackContrasena(contrasena));
      return;
    }
    setGuardando(true);
    try {
      const exito = await crearAdministrador({
        nombre,
        correo,
        contrasena,
        rol,
      });
      if (exito) {
        onCreado();
      } else {
        console.error("crearAdministrador falló para correo:", correo);
        avisar("Error", "No se pudo crear el administrador.");
      }
    } catch (err) {
      console.error("Excepción al crear administrador:", err);
      avisar(
        "Error",
        err instanceof Error
          ? err.message
          : "No se pudo crear el administrador.",
      );
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
          <Text style={styles.modalTitle}>Nuevo Administrador</Text>
          <CampoTexto
            etiqueta="Nombre completo"
            valor={nombre}
            onChangeText={setNombre}
            icono="person-outline"
          />
          <CampoTexto
            etiqueta="Correo electrónico"
            valor={correo}
            onChangeText={setCorreo}
            icono="mail-outline"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <CampoTexto
            etiqueta="Contraseña temporal"
            valor={contrasena}
            onChangeText={setContrasena}
            icono="lock-closed-outline"
            secureTextEntry={!verPass}
            iconoFinal={verPass ? "eye-off-outline" : "eye-outline"}
            onPressIconoFinal={() => setVerPass(!verPass)}
          />
          {feedback !== "" && (
            <Text
              style={[
                styles.passwordFeedback,
                feedback.includes("✓") && styles.passwordFeedbackOk,
              ]}
            >
              {feedback}
            </Text>
          )}
          <Text style={styles.segmentedLabel}>ROL</Text>
          <SegmentedRow
            opciones={[
              { value: "administrador", label: "Administrador" },
              { value: "coordinador", label: "Coordinador" },
            ]}
            valor={rol}
            onCambiar={(v) => setRol(v as "administrador" | "coordinador")}
          />
          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={crear}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Crear</Text>
              )}
            </Pressable>
          </View>
          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// CICLO DE VIDA DE DATOS: REPORTE
// ════════════════════════════════════════════════════════════════════
function ReportePeriodoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [reporte, setReporte] = useState<Record<string, any>[]>([]);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const handleGenerateReport = async () => {
    const ano = parseInt(year, 10);
    if (isNaN(ano)) {
      Alert.alert("Error", "Por favor, ingresa un año válido.");
      return;
    }
    setCargando(true);
    try {
      const datos = await generarReporteAspirantesPeriodo(ano);
      setReporte(datos);
    } catch {
      Alert.alert("Error", "No se pudo generar el reporte.");
    } finally {
      setCargando(false);
    }
  };

  const handleDownloadCsv = async () => {
    const ano = parseInt(year, 10);
    if (isNaN(ano) || reporte.length === 0) return;

    setDescargando(true);
    try {
      const csv = reporteACsv(reporte, ano);
      const nombreArchivo = `Reporte_Periodo_${ano}.csv`;

      if (Platform.OS === "web") {
        // expo-file-system no funciona en web (cacheDirectory es null ahí,
        // por eso "Descargar CSV" tronaba con "No se pudo generar el
        // archivo CSV" al usarlo desde el navegador). En web se descarga
        // con un Blob + <a download>, como cualquier descarga de archivo.
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
      } else {
        // Nota: el Flutter original generaba un .xlsx con formato (banner,
        // colores, anchos de columna). Aquí se simplificó a CSV para no
        // depender de una librería de Excel dentro de React Native — se
        // abre igual en Excel/Sheets. Usamos la API "legacy" de
        // `expo-file-system` (más estable en cuanto a tipos) y
        // `expo-sharing`.
        const FileSystem = await import("expo-file-system/legacy");
        const fileUri = `${FileSystem.cacheDirectory}${nombreArchivo}`;

        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Guardar reporte del periodo",
          });
        } else {
          Alert.alert("Reporte generado", `Se guardó en: ${fileUri}`);
        }
      }
    } catch {
      Alert.alert("Error", "No se pudo generar el archivo CSV.");
    } finally {
      setDescargando(false);
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
        <View style={[styles.modalContainer, { maxWidth: 500 }]}>
          <Text style={styles.modalTitle}>Exportar Reporte por Período</Text>

          <CampoTexto
            etiqueta="Año del periodo"
            valor={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            placeholder={new Date().getFullYear().toString()}
            icono="calendar-outline"
          />

          {cargando && <ActivityIndicator style={{ marginVertical: 20 }} />}

          {!cargando && reporte.length > 0 && (
            <View style={styles.reportPreview}>
              <Text style={{ fontWeight: "bold" }}>
                Aspirantes encontrados: {reporte.length}
              </Text>
              <ScrollView style={{ maxHeight: 150, marginTop: 8 }}>
                {reporte.map((item, index) => (
                  <Text key={index} style={styles.reportItem}>
                    {item.nombre} - {item.folio}
                  </Text>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={handleGenerateReport}
            >
              <Text style={styles.actionButtonText}>Generar Reporte</Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionButton,
                reporte.length === 0 && { opacity: 0.5 },
              ]}
              onPress={handleDownloadCsv}
              disabled={reporte.length === 0 || descargando}
            >
              {descargando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Descargar CSV</Text>
              )}
            </Pressable>
          </View>

          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// CICLO DE VIDA DE DATOS: ARCHIVAR (PURGAR)
// ════════════════════════════════════════════════════════════════════
function ArchivarPeriodoModal({
  visible,
  onClose,
  onDataUpdated,
}: {
  visible: boolean;
  onClose: () => void;
  onDataUpdated: () => void;
}) {
  const [year, setYear] = useState((new Date().getFullYear() - 1).toString());
  const [cargando, setCargando] = useState(false);
  const confirmar = useConfirm();

  const handlePurge = () => {
    const ano = parseInt(year, 10);
    if (isNaN(ano)) {
      Alert.alert("Error", "Por favor, ingresa un año válido.");
      return;
    }

    // Nota: Alert.alert(title, msg, [botones]) NO funciona en React Native
    // Web (los botones y su onPress se pierden en silencio: por eso
    // "Archivar Período" no hacía nada al presionarlo desde el navegador).
    // Se reemplaza por useConfirm(), que muestra un Modal real igual en
    // iOS, Android y web.
    confirmar({
      titulo: "Confirmar Archivado",
      mensaje: `Esta acción archivará (eliminará de forma permanente) a todos los aspirantes del periodo ${ano} y no se puede deshacer. ¿Estás seguro?`,
      textoConfirmar: "Sí, Archivar",
      destructivo: true,
      onConfirmar: async () => {
        setCargando(true);
        try {
          const exito = await purgarAspirantesPeriodo(ano);
          if (exito) {
            onDataUpdated();
            Alert.alert("Éxito", `Se han archivado los datos del año ${ano}.`);
            onClose();
          } else {
            Alert.alert("Error", "No se pudo completar el archivado.");
          }
        } catch {
          Alert.alert("Error", "Ocurrió un error durante el archivado.");
        } finally {
          setCargando(false);
        }
      },
    });
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
          <Text style={styles.modalTitle}>Archivar Período Caducado</Text>
          <CampoTexto
            etiqueta="Año del periodo a archivar"
            valor={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            icono="trash-outline"
          />
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.actionButton, styles.purgeButton]}
              onPress={handlePurge}
              disabled={cargando}
            >
              {cargando ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionButtonText}>
                  Archivar Período {year}
                </Text>
              )}
            </Pressable>
          </View>
          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CORREO AUTOMÁTICO
// ════════════════════════════════════════════════════════════════════
function CorreosConfigModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<Record<string, any> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [limite, setLimite] = useState("100");
  const [umbral, setUmbral] = useState("80");
  const [limiteMensual, setLimiteMensual] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const datos = await obtenerConfiguracion();
    setConfig(datos);
    if (datos) {
      setLimite(String(datos.limite_diario ?? 100));
      setUmbral(String(datos.umbral_alerta ?? 80));
      setLimiteMensual(
        datos.limite_mensual !== undefined && datos.limite_mensual !== null
          ? String(datos.limite_mensual)
          : null,
      );
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => cargar());
  }, [visible, cargar]);

  if (!visible) return null;

  const enviadosHoy = Number(config?.correos_enviados_hoy ?? 0);
  const limiteNum = parseInt(limite, 10) || 0;
  const umbralNum = parseInt(umbral, 10) || 0;
  const progreso = limiteNum > 0 ? Math.min(1, enviadosHoy / limiteNum) : 0;
  const enAlerta =
    limiteNum > 0 && (enviadosHoy / limiteNum) * 100 >= umbralNum;

  const enviadosMes = Number(config?.correos_enviados_mes_actual ?? 0);
  const limiteMensualNum = limiteMensual ? parseInt(limiteMensual, 10) || 0 : 0;
  const progresoMensual =
    limiteMensualNum > 0 ? Math.min(1, enviadosMes / limiteMensualNum) : 0;
  const enAlertaMensual =
    limiteMensualNum > 0 && (enviadosMes / limiteMensualNum) * 100 >= umbralNum;

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
    let exito = false;
    // Si se proporcionó un límite mensual, lo guardamos (puede ser null para limpiar)
    if (limiteMensual !== null && limiteMensual !== "") {
      const lm = parseInt(limiteMensual, 10);
      if (isNaN(lm) || lm <= 0) {
        setGuardando(false);
        Alert.alert("Error", "Ingresa un límite mensual válido mayor a 0.");
        return;
      }
      exito = await actualizarLimitesMensuales({
        limiteMensual: lm,
        umbralAlerta: u,
      });
    } else {
      // Guardamos solo límites diarios
      exito = await actualizarLimites({ limiteDiario: l, umbralAlerta: u });
    }
    setGuardando(false);
    if (exito) {
      Alert.alert("Listo", "Configuración guardada.");
      cargar();
    } else {
      Alert.alert("Error", "No se pudo guardar la configuración.");
    }
  };

  const reiniciarContador = async () => {
    setGuardando(true);
    await reiniciarContadorManual();
    await cargar();
    setGuardando(false);
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
            Configuración de Correo Automático
          </Text>

          {cargando ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : !config ? (
            <Text style={styles.emptyText}>
              No se encontró la fila de configuración (id = 1) en la tabla
              configuracion_correos.
            </Text>
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
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}
              >
                <Text style={styles.dashboardNumero}>{enviadosHoy}</Text>
                <Text style={styles.dashboardTotal}> / {limiteNum}</Text>
                {enAlerta && (
                  <View style={styles.alertaBadge}>
                    <Text style={styles.alertaBadgeTexto}>
                      ⚠️ Cerca del límite
                    </Text>
                  </View>
                )}
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
                  etiqueta="Límite mensual de correos (opcional)"
                  valor={limiteMensual ?? ""}
                  onChangeText={(v) => setLimiteMensual(v === "" ? null : v)}
                  keyboardType="number-pad"
                  icono="calendar-outline"
                />
                <CampoTexto
                  etiqueta="Umbral de alerta (%)"
                  valor={umbral}
                  onChangeText={setUmbral}
                  keyboardType="number-pad"
                  icono="warning-outline"
                />
              </View>

              {/* Estadísticas mensuales (si aplica) */}
              {limiteMensualNum > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.dashboardLabel}>
                    Correos enviados este mes
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    <Text style={styles.dashboardNumero}>{enviadosMes}</Text>
                    <Text style={styles.dashboardTotal}>
                      {" "}
                      / {limiteMensualNum}
                    </Text>
                    {enAlertaMensual && (
                      <View style={styles.alertaBadge}>
                        <Text style={styles.alertaBadgeTexto}>
                          ⚠️ Cerca del límite mensual
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.progresoFondo}>
                    <View
                      style={[
                        styles.progresoRelleno,
                        {
                          width: `${progresoMensual * 100}%`,
                          backgroundColor: enAlertaMensual
                            ? "orange"
                            : "#16A34A",
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

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

          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// HISTORIAL DE CORREOS
// ════════════════════════════════════════════════════════════════════
function HistorialCorreosModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [registros, setRegistros] = useState<Record<string, any>[]>([]);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string | undefined>(
    undefined,
  );

  const cargar = useCallback(async (estado?: string) => {
    setCargando(true);
    const datos = await obtenerHistorial({ estado });
    setRegistros(datos);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => cargar(filtroEstado));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtros: { label: string; value?: string }[] = [
    { label: "Todos", value: undefined },
    { label: "Enviados", value: "enviado" },
    { label: "Omitidos", value: "omitido" },
    { label: "Con error", value: "error" },
  ];

  const colorEstado = (estado: string) =>
    estado === "enviado"
      ? "#16A34A"
      : estado === "error"
        ? "#DC2626"
        : "orange";
  const iconoEstado = (estado: string): keyof typeof Ionicons.glyphMap =>
    estado === "enviado"
      ? "checkmark-circle-outline"
      : estado === "error"
        ? "alert-circle-outline"
        : "remove-circle-outline";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContainer, { maxHeight: "85%" }]}>
          <Text style={styles.modalTitle}>Historial de Correos</Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {filtros.map((f) => {
              const activo = f.value === filtroEstado;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => {
                    setFiltroEstado(f.value);
                    cargar(f.value);
                  }}
                  style={[styles.chip, activo && styles.chipActivo]}
                >
                  <Text
                    style={[styles.chipTexto, activo && styles.chipTextoActivo]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {cargando ? (
            <ActivityIndicator style={{ marginVertical: 24 }} />
          ) : registros.length === 0 ? (
            <Text style={styles.emptyText}>
              Sin registros para este filtro.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 340 }}>
              {registros.map((r, index) => {
                const estado = String(r.estado ?? "");
                const fecha = r.fecha ? new Date(r.fecha) : null;
                return (
                  <View key={r.id ?? index} style={styles.historialRow}>
                    <Ionicons
                      name={iconoEstado(estado)}
                      size={18}
                      color={colorEstado(estado)}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={styles.historialDestinatario}
                        numberOfLines={1}
                      >
                        {r.destinatario ?? "Sin destinatario"}
                      </Text>
                      <Text style={styles.historialSubtitulo} numberOfLines={2}>
                        {[
                          r.tipo,
                          r.error ? `Error: ${r.error}` : null,
                          fecha ? fecha.toLocaleString() : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => cargar(filtroEstado)}
            >
              <Text style={styles.actionButtonText}>Actualizar</Text>
            </Pressable>
          </View>
          <Pressable style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════
// APARIENCIA DEL SISTEMA
// ════════════════════════════════════════════════════════════════════
const PALETAS_PREDEFINIDAS: { nombre: string; p: string; s: string }[] = [
  { nombre: "Azul UT (actual)", p: "#0055A4", s: "#6DFE9C" },
  { nombre: "Índigo nocturno", p: "#4F46E5", s: "#818CF8" },
  { nombre: "Esmeralda", p: "#047857", s: "#34D399" },
  { nombre: "Atardecer", p: "#EA580C", s: "#FBBF24" },
  { nombre: "Fucsia", p: "#BE185D", s: "#F472B6" },
  { nombre: "Grafito", p: "#334155", s: ColoresApp.textoSecundario },
];

// Combos completos (color + fondo + estilo de tarjeta) para armar toda la
// apariencia de un toque, sin tener que ir campo por campo.
const TEMAS_RAPIDOS: {
  nombre: string;
  cambios: Partial<TemaConfig>;
}[] = [
  {
    nombre: "Azul UT clásico",
    cambios: {
      modo: "claro",
      colorPrimario: "#0055A4",
      colorSecundario: "#6DFE9C",
      fondoTipo: "color",
      fondoColor: "#F2F5FA",
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Morado nocturno",
    cambios: {
      modo: "oscuro",
      colorPrimario: "#8B5CF6",
      colorSecundario: "#A78BFA",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#0B0821",
      fondoGradienteFin: "#1E1750",
      fondoGradienteAnimado: false,
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Esmeralda glass",
    cambios: {
      modo: "claro",
      colorPrimario: "#047857",
      colorSecundario: "#34D399",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#ECFDF5",
      fondoGradienteFin: "#A7F3D0",
      fondoGradienteAnimado: false,
      estiloTarjeta: "glass",
    },
  },
  {
    nombre: "Atardecer cálido",
    cambios: {
      modo: "claro",
      colorPrimario: "#EA580C",
      colorSecundario: "#FBBF24",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#FFF7ED",
      fondoGradienteFin: "#FED7AA",
      fondoGradienteAnimado: false,
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Grafito minimal",
    cambios: {
      modo: "claro",
      colorPrimario: "#334155",
      colorSecundario: "#94A3B8",
      fondoTipo: "color",
      fondoColor: "#F1F5F9",
      estiloTarjeta: "plano",
    },
  },
];

const ROLES_TEMA: { valor: TemaConfig["rol"]; etiqueta: string }[] = [
  { valor: "admin", etiqueta: "Admin" },
  { valor: "aspirante", etiqueta: "Aspirante" },
];

function AparienciaModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [rolActivo, setRolActivo] = useState<TemaConfig["rol"]>("admin");
  const { tema, guardar, cargando: cargandoTema } = useTemaControlador(rolActivo);
  const [borrador, setBorrador] = useState<TemaConfig>(tema);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => setBorrador(tema));
  }, [visible, tema]);

  const cerrarYResetear = () => {
    setRolActivo("admin");
    onClose();
  };

  // IMPORTANTE: al cambiar de pestaña (Admin/Aspirante) el tema del rol
  // nuevo se carga de Supabase de forma asíncrona; si el admin edita un
  // color justo después de cambiar de pestaña pero antes de que esa carga
  // termine, `borrador` podía quedar con datos de la pestaña anterior
  // (incluido el campo `rol`), guardando por error en la fila equivocada
  // o mezclando valores entre roles. Forzamos aquí `rol: rolActivo` en
  // cada cambio para que, pase lo que pase con el timing de la carga, el
  // guardado siempre vaya a la fila del rol que se está viendo en pantalla.
  const cambiar = (cambios: Partial<TemaConfig>) =>
    setBorrador((b) => ({ ...b, ...cambios, rol: rolActivo }));

  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenesRecientes, setImagenesRecientes] = useState<string[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);

  useEffect(() => {
    if (!visible || borrador.fondoTipo !== "imagen") return;
    let activo = true;

    (async () => {
      setCargandoRecientes(true);
      const urls = await listarImagenesFondoRecientes(rolActivo);
      if (activo) {
        setImagenesRecientes(urls);
        setCargandoRecientes(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [visible, borrador.fondoTipo, rolActivo]);

  const guardarCambios = async () => {
    // Si el tema del rol seleccionado todavía se está cargando de Supabase
    // (por ejemplo, si guardas justo después de cambiar de pestaña), no
    // dejamos guardar: `borrador` podría no corresponder todavía al rol
    // activo y guardaríamos datos equivocados o incompletos.
    if (cargandoTema) {
      avisar(
        "Espera un momento",
        "El tema de esta pestaña todavía se está cargando. Intenta de nuevo en un segundo.",
      );
      return;
    }
    setGuardando(true);
    let exito = false;
    let error: string | undefined;
    try {
      const res = await guardar({ ...borrador, rol: rolActivo });
      exito = res.exito;
      error = res.error;
    } catch (e) {
      console.error("Excepción al guardar apariencia:", e);
      error = e instanceof Error ? e.message : String(e);
    } finally {
      setGuardando(false);
    }
    avisar(
      exito ? "Listo" : "Error",
      exito
        ? "Apariencia guardada y aplicada a todo el sistema."
        : `No se pudo guardar. ${error ?? "Revisa que exista la tabla configuracion_tema en Supabase."}`,
    );
    if (exito) cerrarYResetear();
  };

  const elegirImagenFondo = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const archivo = resultado.assets[0];

      setSubiendoImagen(true);
      const respuesta = await fetch(archivo.uri);
      const bytes = await respuesta.blob();
      const url = await subirImagenFondoTema(
        rolActivo,
        bytes,
        archivo.name,
        archivo.mimeType,
      );
      if (url) {
        cambiar({ fondoImagenUrl: url });
        setImagenesRecientes((prev) => [url, ...prev]);
      } else {
        avisar("Error", "No se pudo subir la imagen. Intenta de nuevo.");
      }
    } catch (e) {
      console.error("Excepción al elegir/subir imagen de fondo:", e);
      avisar("Error", "Ocurrió un problema al seleccionar la imagen.");
    } finally {
      setSubiendoImagen(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cerrarYResetear}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContainer, styles.aparienciaModalContainer]}>
          <Text style={styles.modalTitle}>Apariencia del Sistema</Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {ROLES_TEMA.map((r) => {
              const activo = rolActivo === r.valor;
              return (
                <Pressable
                  key={r.valor}
                  onPress={() => setRolActivo(r.valor)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 20,
                    alignItems: "center",
                    backgroundColor: activo
                      ? ColoresApp.primario
                      : ColoresApp.borde,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      fontSize: 13,
                      color: activo ? "white" : ColoresApp.textoSecundario,
                    }}
                  >
                    {r.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView>
            <Text style={styles.segmentedLabel}>TEMAS RÁPIDOS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {TEMAS_RAPIDOS.map((rapido) => (
                <Pressable
                  key={rapido.nombre}
                  onPress={() => cambiar(rapido.cambios)}
                  style={{
                    marginRight: 10,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: ColoresApp.borde,
                    width: 92,
                  }}
                >
                  <View
                    style={{
                      height: 46,
                      backgroundColor:
                        rapido.cambios.fondoTipo === "gradiente"
                          ? rapido.cambios.fondoGradienteFin
                          : rapido.cambios.fondoColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        backgroundColor: rapido.cambios.colorPrimario,
                      }}
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 10.5,
                      fontWeight: "600",
                      textAlign: "center",
                      color: ColoresApp.texto,
                      paddingHorizontal: 4,
                      paddingVertical: 6,
                    }}
                  >
                    {rapido.nombre}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <VistaPreviaTema tema={borrador} />

            <Text style={styles.segmentedLabel}>MODO</Text>
            <SegmentedRow
              opciones={[
                { value: "claro", label: "Claro" },
                { value: "oscuro", label: "Oscuro" },
                { value: "auto", label: "Auto" },
              ]}
              valor={borrador.modo}
              onCambiar={(v) => cambiar({ modo: v as TemaConfig["modo"] })}
            />

            <Text style={styles.segmentedLabel}>COLOR DEL SISTEMA</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {PALETAS_PREDEFINIDAS.map((paleta) => {
                const seleccionada =
                  borrador.colorPrimario.toUpperCase() ===
                  paleta.p.toUpperCase();
                return (
                  <Pressable
                    key={paleta.nombre}
                    onPress={() =>
                      cambiar({
                        colorPrimario: paleta.p,
                        colorSecundario: paleta.s,
                      })
                    }
                    style={[
                      styles.paletaCirculo,
                      {
                        backgroundColor: paleta.p,
                        borderColor: seleccionada ? paleta.p : "transparent",
                      },
                    ]}
                  >
                    {seleccionada && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <ColorPickerCampo
              etiqueta="Color primario"
              ayuda="Botones y detalles principales"
              valor={borrador.colorPrimario}
              onChangeText={(v) => cambiar({ colorPrimario: v })}
            />
            <ColorPickerCampo
              etiqueta="Color secundario / acento"
              ayuda="Detalles, bordes y puntos de énfasis"
              valor={borrador.colorSecundario}
              onChangeText={(v) => cambiar({ colorSecundario: v })}
            />
            <ColorPickerCampo
              etiqueta="Color de texto"
              ayuda="Texto sobre el fondo configurado abajo"
              valor={borrador.colorTexto}
              onChangeText={(v) => cambiar({ colorTexto: v })}
            />

            <Text style={styles.segmentedLabel}>FONDO</Text>
            <SegmentedRow
              opciones={[
                { value: "color", label: "Color" },
                { value: "gradiente", label: "Degradado" },
                { value: "imagen", label: "Imagen" },
                { value: "transparente", label: "Transparente" },
              ]}
              valor={borrador.fondoTipo}
              onCambiar={(v) =>
                cambiar({ fondoTipo: v as TemaConfig["fondoTipo"] })
              }
            />
            {borrador.fondoTipo === "transparente" && (
              <Text style={styles.modalSubtitle}>
                Sin color de fondo: se ve el fondo nativo del dispositivo/
                navegador detrás de cada pantalla.
              </Text>
            )}
            {borrador.fondoTipo === "color" && (
              <ColorPickerCampo
                etiqueta="Color de fondo"
                valor={borrador.fondoColor}
                onChangeText={(v) => cambiar({ fondoColor: v })}
              />
            )}
            {borrador.fondoTipo === "gradiente" && (
              <>
                <ColorPickerCampo
                  etiqueta="Degradado — color inicial"
                  valor={borrador.fondoGradienteInicio}
                  onChangeText={(v) => cambiar({ fondoGradienteInicio: v })}
                />
                <ColorPickerCampo
                  etiqueta="Degradado — color final"
                  valor={borrador.fondoGradienteFin}
                  onChangeText={(v) => cambiar({ fondoGradienteFin: v })}
                />
                <Pressable
                  onPress={() =>
                    cambiar({
                      fondoGradienteAnimado: !borrador.fondoGradienteAnimado,
                    })
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: ColoresApp.texto, fontWeight: "600" }}>
                    Animar degradado
                  </Text>
                  <View
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      padding: 2,
                      backgroundColor: borrador.fondoGradienteAnimado
                        ? ColoresApp.primario
                        : ColoresApp.borde,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "white",
                        alignSelf: borrador.fondoGradienteAnimado
                          ? "flex-end"
                          : "flex-start",
                      }}
                    />
                  </View>
                </Pressable>
                {borrador.fondoGradienteAnimado && (
                  <CampoTexto
                    etiqueta="Velocidad de la animación (ms, ej. 6000)"
                    valor={String(borrador.fondoGradienteDuracionMs)}
                    onChangeText={(v) => {
                      const n = parseInt(v, 10);
                      if (!isNaN(n))
                        cambiar({
                          fondoGradienteDuracionMs: Math.max(1000, n),
                        });
                    }}
                    keyboardType="number-pad"
                    icono="speedometer-outline"
                  />
                )}
              </>
            )}
            {borrador.fondoTipo === "imagen" && (
              <>
                <Text style={styles.segmentedLabel}>IMAGEN DE FONDO</Text>
                <Pressable
                  style={styles.selectorImagenBoton}
                  onPress={elegirImagenFondo}
                  disabled={subiendoImagen}
                >
                  {subiendoImagen ? (
                    <ActivityIndicator
                      size="small"
                      color={ColoresApp.primario}
                    />
                  ) : (
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={ColoresApp.primario}
                    />
                  )}
                  <Text style={styles.selectorImagenTexto} numberOfLines={1}>
                    {subiendoImagen
                      ? "Subiendo imagen..."
                      : "Elegir imagen desde mi celular o computadora"}
                  </Text>
                </Pressable>
                <CampoTexto
                  etiqueta="O pega la URL de una imagen (opcional)"
                  valor={borrador.fondoImagenUrl ?? ""}
                  onChangeText={(v) => cambiar({ fondoImagenUrl: v })}
                  icono="link-outline"
                  autoCapitalize="none"
                />
                {(cargandoRecientes || imagenesRecientes.length > 0) && (
                  <>
                    <Text style={styles.segmentedLabel}>
                      RECIENTES (TOCA PARA REUSAR)
                    </Text>
                    {cargandoRecientes ? (
                      <ActivityIndicator
                        size="small"
                        color={ColoresApp.primario}
                      />
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 8 }}
                      >
                        {imagenesRecientes.map((url) => {
                          const activa = borrador.fondoImagenUrl === url;
                          return (
                            <Pressable
                              key={url}
                              onPress={() => cambiar({ fondoImagenUrl: url })}
                              style={{
                                marginRight: 8,
                                borderRadius: 10,
                                overflow: "hidden",
                                borderWidth: activa ? 3 : 1,
                                borderColor: activa
                                  ? ColoresApp.primario
                                  : ColoresApp.borde,
                              }}
                            >
                              <Image
                                source={{ uri: url }}
                                style={{ width: 64, height: 64 }}
                                resizeMode="cover"
                              />
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}
                <Text style={styles.segmentedLabel}>
                  OSCURECER IMAGEN (
                  {Math.round(borrador.fondoOpacidadOverlay * 100)}%)
                </Text>
                <DeslizadorSimple
                  valor={borrador.fondoOpacidadOverlay}
                  onCambiar={(v) => cambiar({ fondoOpacidadOverlay: v })}
                  color={ColoresApp.primario}
                  colorPista={ColoresApp.borde}
                />
              </>
            )}

            <Text style={styles.segmentedLabel}>ESTILO DE TARJETAS</Text>
            <SegmentedRow
              opciones={[
                { value: "plano", label: "Plano" },
                { value: "sombra", label: "Sombra" },
                { value: "glass", label: "Glass" },
              ]}
              valor={borrador.estiloTarjeta}
              onCambiar={(v) =>
                cambiar({ estiloTarjeta: v as TemaConfig["estiloTarjeta"] })
              }
            />
            <CampoTexto
              etiqueta="Radio de bordes (0 a 32px)"
              valor={String(borrador.radioBordes)}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n))
                  cambiar({ radioBordes: Math.min(32, Math.max(0, n)) });
              }}
              keyboardType="number-pad"
              icono="ellipse-outline"
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => setBorrador(temaConfigPorDefecto(rolActivo))}
            >
              <Text style={styles.actionButtonText}>Restaurar por defecto</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={guardarCambios}
              disabled={guardando || cargandoTema}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Guardar</Text>
              )}
            </Pressable>
          </View>
          <Pressable style={{ marginTop: 16 }} onPress={cerrarYResetear}>
            <Text style={{ textAlign: "center", color: "grey" }}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  selectorImagenBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: ColoresApp.primario,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  selectorImagenTexto: {
    color: ColoresApp.primario,
    fontWeight: "600",
    flexShrink: 1,
  },
  container: { flex: 1, backgroundColor: ColoresApp.fondo },
  scrollContent: { paddingVertical: 28, paddingHorizontal: 20 },
  contentWrapper: {
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
    gap: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: ColoresApp.oscuro,
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 13,
    color: ColoresApp.textoSecundario,
    marginTop: -20,
  },
  profileCard: {
    backgroundColor: ColoresApp.oscuro,
    borderRadius: 20,
    padding: 20,
    boxShadow: `0 8px 20px ${ColoresApp.oscuro}40`,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(109, 254, 156, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileTextContainer: { flex: 1, marginLeft: 16 },
  profileName: { color: "white", fontSize: 17, fontWeight: "bold" },
  profileEmail: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  roleBadge: {
    backgroundColor: "rgba(109, 254, 156, 0.2)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(109, 254, 156, 0.4)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  roleText: { color: "#6DFE9C", fontSize: 11, fontWeight: "bold" },
  editButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  editButtonText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    boxShadow: "0 4px 12px #0000000A",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: ColoresApp.oscuro },
  divider: {
    height: 1,
    backgroundColor: ColoresApp.borde,
    marginHorizontal: 20,
  },
  tileContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tileIconWrapper: {
    backgroundColor: ColoresApp.borde,
    borderRadius: 10,
    padding: 8,
  },
  tileTextContainer: { flex: 1, marginLeft: 12 },
  tileTitle: { fontSize: 14, fontWeight: "600", color: ColoresApp.oscuro },
  tileSubtitle: { fontSize: 12, color: ColoresApp.textoSecundario },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  infoLabel: { fontSize: 13, color: "grey" },
  infoValue: { fontSize: 13, fontWeight: "bold", color: ColoresApp.oscuro },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "red",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutButtonText: { color: "red", fontWeight: "600" },
  footerText: {
    color: ColoresApp.textoSecundario,
    fontSize: 12,
    textAlign: "center",
    marginTop: -8,
  },
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
    maxWidth: 460,
    gap: 4,
  },
  aparienciaModalContainer: {
    maxWidth: 640,
    maxHeight: "94%",
    width: "100%",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  modalSubtitle: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginBottom: 4,
  },
  reportPreview: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  reportItem: { fontSize: 12, color: ColoresApp.textoSecundario },
  modalActions: { marginTop: 16, gap: 10 },
  actionButton: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: { color: "white", fontWeight: "bold" },
  purgeButton: { backgroundColor: "red" },
  emptyText: {
    textAlign: "center",
    color: "grey",
    fontSize: 13,
    marginVertical: 20,
  },
  adminRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  adminRowInactivo: { backgroundColor: "#F5F5F5" },
  adminNombre: { fontSize: 14, fontWeight: "600", color: ColoresApp.oscuro },
  adminCorreo: { fontSize: 11, color: ColoresApp.textoSecundario },
  adminRol: {
    fontSize: 10,
    color: ColoresApp.primario,
    fontWeight: "bold",
    marginTop: 2,
  },
  segmentedLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.textoSecundario,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: ColoresApp.borde,
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
  segmentedItemActivo: { backgroundColor: ColoresApp.oscuro },
  segmentedItemTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
  segmentedItemTextoActivo: { color: "white" },
  passwordFeedback: {
    fontSize: 12,
    color: "#D64545",
    marginTop: -8,
    marginBottom: 8,
  },
  passwordFeedbackOk: { color: "#16A34A" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  switchTitle: { fontSize: 14, fontWeight: "600", color: ColoresApp.oscuro },
  switchSubtitle: { fontSize: 11, color: ColoresApp.textoSecundario },
  dashboardLabel: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 10,
  },
  dashboardNumero: {
    fontSize: 26,
    fontWeight: "bold",
    color: ColoresApp.oscuro,
  },
  dashboardTotal: { fontSize: 16, color: ColoresApp.textoSecundario },
  alertaBadge: {
    marginLeft: "auto",
    backgroundColor: "rgba(255,165,0,0.15)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertaBadgeTexto: { fontSize: 11, color: "orange", fontWeight: "bold" },
  progresoFondo: {
    height: 8,
    borderRadius: 6,
    backgroundColor: ColoresApp.borde,
    marginTop: 8,
    overflow: "hidden",
  },
  progresoRelleno: { height: 8, borderRadius: 6 },
  chip: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActivo: {
    backgroundColor: ColoresApp.oscuro,
    borderColor: ColoresApp.oscuro,
  },
  chipTexto: { fontSize: 12, color: ColoresApp.oscuro },
  chipTextoActivo: { color: "white" },
  historialRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  historialDestinatario: {
    fontSize: 13,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
  historialSubtitulo: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  previewBox: {
    height: 90,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  previewDot: { width: 12, height: 12, borderRadius: 6 },
  paletaCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});