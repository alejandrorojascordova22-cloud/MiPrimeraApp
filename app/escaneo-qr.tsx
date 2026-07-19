import { ColoresApp } from "@/constants/coloresApp";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { registrarAsistenciaQR } from "@/services/aspirantesServicio";

// ========================================================================
// PANTALLA DE ESCANEO QR
// ========================================================================

export default function PantallaEscaneoQR() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isManualModalVisible, setManualModalVisible] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [scanMessage, setScanMessage] = useState<string>(
    "Alinea el QR dentro del recuadro y la cámara enfocará automáticamente.",
  );
  const [scanDebug, setScanDebug] = useState<string | null>(null);
  const [resultadoModal, setResultadoModal] = useState<{
    tipo: "exito" | "aviso" | "error";
    titulo: string;
    mensaje: string;
  } | null>(null);
  const isProcessingRef = useRef(false);
  const lastScanTime = useRef<Date | null>(null);
  const focusScale = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(focusScale, {
          toValue: 1.02,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(focusScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [focusScale]);

  const handleBarCodeScanned = async (event: any) => {
    const data = event?.data ?? event?.nativeEvent?.data;
    console.log("[QR] onBarcodeScanned event:", event);
    setScanDebug(JSON.stringify(event));

    if (!data) {
      setScanMessage("Se detectó algo, pero el payload no tiene datos.");
      return;
    }

    const now = new Date();
    if (
      isProcessingRef.current ||
      (lastScanTime.current &&
        now.getTime() - lastScanTime.current.getTime() < 2000)
    ) {
      return;
    }

    setScannerEnabled(false);
    isProcessingRef.current = true;
    setProcessing(true);
    setScanMessage("QR detectado. Procesando asistencia...");
    lastScanTime.current = now;

    try {
      try {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        } else if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(50);
        }
      } catch (hapticsError) {
        console.warn("[QR] haptics notification failed", hapticsError);
      }

      const normalized = String(data).trim();
      const parts = normalized.split("|");
      if (parts.length < 2) {
        setScanMessage("QR leído, pero el formato no es válido.");
        showError("Código QR inválido. Intenta de nuevo.");
        return;
      }

      const [folio, correo] = parts.map((part) => part.trim());
      await processAttendance(
        folio,
        correo,
        Platform.OS === "web" ? "Web" : "Principal",
      );
    } catch (error: any) {
      console.warn("[QR] processing failed", error);
      showError("Ocurrió un error al procesar el QR. Intenta de nuevo.");
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
      // No reactivamos el scanner aquí si vamos a mostrar una ventanita
      // de resultado (éxito / aviso / error): la cámara debe quedarse
      // pausada hasta que la persona cierre esa ventanita, para que no
      // siga detectando el mismo QR una y otra vez de fondo.
      setScanMessage(
        "Alinea el QR dentro del recuadro y la cámara enfocará automáticamente.",
      );
    }
  };

  const processAttendance = async (
    folio: string,
    correo: string,
    sede: string,
  ) => {
    try {
      console.log("[QR] procesando asistencia", { folio, correo, sede });
      const resultado = await registrarAsistenciaQR({ folio, correo, sede });
      console.log("[QR] resultado registrarAsistenciaQR", resultado);
      if (!resultado) {
        setScanMessage("No se encontró el aspirante o falló el registro.");
        showError("Aspirante no encontrado o error al registrar.");
      } else if (resultado.registradoAhora) {
        setScanMessage("Asistencia registrada exitosamente.");
        showSuccess(resultado.nombre || "Aspirante", resultado.folio || "N/A");
      } else {
        setScanMessage("El aspirante ya tenía asistencia registrada.");
        showAviso(
          resultado.nombre || "Aspirante",
          resultado.folio || "N/A",
          resultado.ultima_registrado_en || "desconocido",
        );
      }
    } catch (e: any) {
      console.warn("[QR] processAttendance error", e);
      setScanMessage("Error al registrar la asistencia.");
      showError(`Error procesando QR: ${e?.message ?? e}`);
    }
  };

  const showSuccess = (nombre: string, folio: string) => {
    setResultadoModal({
      tipo: "exito",
      titulo: "Asistencia registrada",
      mensaje: `${nombre}\nFolio: ${folio}\n\nPuede pasar a la sala de examen.`,
    });
  };

  const showAviso = (nombre: string, folio: string, ultimoRegistro: string) => {
    setResultadoModal({
      tipo: "aviso",
      titulo: "Asistencia ya registrada",
      mensaje: `${nombre}\nFolio: ${folio}\n\nÚltimo registro: ${formatearFechaAviso(ultimoRegistro)}`,
    });
  };

  const showError = (message: string) => {
    setResultadoModal({
      tipo: "error",
      titulo: "No se pudo registrar",
      mensaje: message,
    });
  };

  const formatearFechaAviso = (iso: string) => {
    if (iso === "desconocido") return iso;
    try {
      return new Date(iso).toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const cerrarResultadoModal = () => {
    setResultadoModal(null);
    setScannerEnabled(true);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text>Se necesita acceso a la cámara para escanear.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Otorgar Permiso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Escanear Asistencia" }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scannerEnabled ? handleBarCodeScanned : undefined}
        barcodeScannerSettings={
          scannerEnabled ? { barcodeTypes: ["qr"] } : undefined
        }
        autofocus="on"
        enableTorch={torchOn}
        onMountError={({ message }) => {
          console.warn("Camera mount error:", message);
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.topActions}>
          <Pressable onPress={() => setTorchOn((v) => !v)}>
            <Ionicons
              name={torchOn ? "flash" : "flash-off"}
              size={24}
              color="white"
            />
          </Pressable>
        </View>

        {!processing && (
          <View pointerEvents="none" style={styles.focusOverlay}>
            <View style={styles.focusMaskTop} />
            <View style={styles.focusMiddleRow}>
              <View style={styles.focusMaskSide} />
              <Animated.View
                style={[
                  styles.focusFrame,
                  { transform: [{ scale: focusScale }] },
                ]}
              >
                <View style={[styles.focusCorner, styles.focusCornerTopLeft]} />
                <View
                  style={[styles.focusCorner, styles.focusCornerTopRight]}
                />
                <View
                  style={[styles.focusCorner, styles.focusCornerBottomLeft]}
                />
                <View
                  style={[styles.focusCorner, styles.focusCornerBottomRight]}
                />
              </Animated.View>
              <View style={styles.focusMaskSide} />
            </View>
            <View style={styles.focusMaskBottom}>
              <Text style={styles.focusHint}>{scanMessage}</Text>
            </View>
          </View>
        )}

        {!processing && (
          <View style={styles.bottomSheet}>
            <Text style={styles.bottomSheetTitle}>
              Apunta la cámara al código QR
            </Text>
            <Text style={styles.bottomSheetSubtitle}>
              Se registrará la asistencia automáticamente
            </Text>
            {scanDebug ? (
              <Text style={styles.scanDebugText} numberOfLines={4}>
                {scanDebug}
              </Text>
            ) : null}
            {!scannerEnabled && !processing ? (
              <Pressable
                style={[styles.manualButton, { marginTop: 10 }]}
                onPress={() => {
                  setScanMessage(
                    "Alinea el QR dentro del recuadro y la cámara enfocará automáticamente.",
                  );
                  setScannerEnabled(true);
                }}
              >
                <Text style={styles.manualButtonText}>Reintentar</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.manualButton}
              onPress={() => setManualModalVisible(true)}
            >
              <Ionicons
                name="keypad-outline"
                size={16}
                color={ColoresApp.primario}
              />
              <Text style={styles.manualButtonText}>Registrar manualmente</Text>
            </Pressable>
          </View>
        )}

        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color="white" size="large" />
            <Text style={styles.processingText}>Procesando...</Text>
          </View>
        )}
      </View>

      <ManualRegistrationModal
        visible={isManualModalVisible}
        onClose={() => setManualModalVisible(false)}
        onSubmit={async (folio, correo) => {
          setManualModalVisible(false);
          setProcessing(true);
          await processAttendance(
            folio,
            correo,
            Platform.OS === "web" ? "Web" : "Manual",
          );
          setProcessing(false);
        }}
      />

      <ResultadoModal
        data={resultadoModal}
        onClose={cerrarResultadoModal}
        onVolverPerfil={() => {
          setResultadoModal(null);
          router.back();
        }}
      />
    </View>
  );
}

const RESULTADO_ESTILOS = {
  exito: {
    color: "#16A34A",
    fondo: "#EFFDF4",
    icono: "checkmark-circle" as const,
  },
  aviso: {
    color: "#7C3AED",
    fondo: "#F5F1FE",
    icono: "information-circle" as const,
  },
  error: {
    color: "#DC2626",
    fondo: "#FEF1F1",
    icono: "close-circle" as const,
  },
};

const ResultadoModal = ({
  data,
  onClose,
  onVolverPerfil,
}: {
  data: { tipo: "exito" | "aviso" | "error"; titulo: string; mensaje: string } | null;
  onClose: () => void;
  onVolverPerfil: () => void;
}) => {
  if (!data) return null;
  const estilo = RESULTADO_ESTILOS[data.tipo];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.resultadoOverlay}>
        <View style={styles.resultadoCard}>
          <View
            style={[
              styles.resultadoIconoWrap,
              { backgroundColor: estilo.fondo },
            ]}
          >
            <Ionicons name={estilo.icono} size={40} color={estilo.color} />
          </View>

          <Text style={[styles.resultadoTitulo, { color: estilo.color }]}>
            {data.titulo}
          </Text>
          <Text style={styles.resultadoMensaje}>{data.mensaje}</Text>

          <View style={styles.resultadoBotones}>
            {data.tipo === "exito" && (
              <Pressable
                style={[styles.resultadoBoton, { backgroundColor: estilo.color }]}
                onPress={onVolverPerfil}
              >
                <Text style={styles.resultadoBotonTextoPrimario}>
                  Volver al perfil
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.resultadoBoton,
                styles.resultadoBotonSecundario,
                data.tipo === "exito" && { marginTop: 8 },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.resultadoBotonTextoSecundario,
                  { color: estilo.color },
                ]}
              >
                Escanear otro código
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ManualRegistrationModal = ({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (folio: string, correo: string) => void;
}) => {
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");

  const handleSubmit = () => {
    if (!folio.trim() || !correo.trim()) {
      Alert.alert("Error", "Folio y correo son requeridos.");
      return;
    }
    onSubmit(folio, correo);
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
          <Text style={styles.modalTitle}>Registro manual de asistencia</Text>
          <TextInput
            style={styles.input}
            placeholder="Folio del aspirante"
            value={folio}
            onChangeText={setFolio}
          />
          <TextInput
            style={styles.input}
            placeholder="Correo del aspirante"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onClose}
            >
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={handleSubmit}
            >
              <Text style={{ color: "white" }}>Registrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- ESTILOS ---

const styles = StyleSheet.create({
  resultadoOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,13,23,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  resultadoCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  resultadoIconoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  resultadoTitulo: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  resultadoMensaje: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  resultadoBotones: { width: "100%" },
  resultadoBoton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resultadoBotonSecundario: {
    backgroundColor: "#F3F1FA",
  },
  resultadoBotonTextoPrimario: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  resultadoBotonTextoSecundario: {
    fontWeight: "700",
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  button: {
    backgroundColor: ColoresApp.primario,
    padding: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  topActions: {
    position: "absolute",
    top: 60,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 8,
    borderRadius: 20,
  },
  marcoEscaneo: {
    position: "absolute",
    top: "32%",
    left: "18%",
    right: "18%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: ColoresApp.resaltado,
    borderRadius: 20,
  },
  focusOverlay: {
    ...StyleSheet.absoluteFill,
  },
  focusMaskTop: {
    flex: 1.3,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  focusMiddleRow: {
    flex: 2,
    flexDirection: "row",
  },
  focusMaskSide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  focusFrame: {
    width: "70%",
    aspectRatio: 1,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: ColoresApp.resaltado,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  focusCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: ColoresApp.resaltado,
  },
  focusCornerTopLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 28,
  },
  focusCornerTopRight: {
    top: 0,
    right: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 28,
  },
  focusCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 28,
  },
  focusCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 28,
  },
  focusMaskBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  focusHint: {
    color: "white",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  bottomSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  bottomSheetTitle: {
    color: ColoresApp.oscuro,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomSheetSubtitle: {
    color: ColoresApp.textoSecundario,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  scanDebugText: {
    color: "white",
    fontSize: 11,
    marginTop: 12,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  manualButtonText: {
    color: ColoresApp.primario,
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 20,
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
  // Estilos del Modal
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
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: ColoresApp.oscuro,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 9,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: ColoresApp.texto,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: ColoresApp.fondo,
  },
  modalButtonSubmit: {
    backgroundColor: ColoresApp.primario,
  },
});