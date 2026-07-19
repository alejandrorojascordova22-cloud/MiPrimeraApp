import { ColoresApp } from "@/constants/coloresApp";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
// import estatico removido, se carga condicional abajo
import { obtenerSesionAspirante } from "@/services/sesionServicio";
import { capturarYGuardarQR, ViewShot } from "@/utils/qrCapture";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

type ViewShotType = any;

// --- TIPOS ---
type Aspirante = {
  id: number;
  nombre: string;
  correo: string;
  folio: string;
  carreraNombre: string;
};

// ========================================================================
// PANTALLA DE CDIGO QR
// ========================================================================

export default function PantallaCodigoQR() {
  const router = useRouter();
  const params = useLocalSearchParams<{ aspirante?: string }>();
  const [aspirante, setAspirante] = useState<Aspirante | null>(
    params.aspirante ? (JSON.parse(params.aspirante) as Aspirante) : null,
  );

  useEffect(() => {
    if (aspirante) return;
    obtenerSesionAspirante().then((sesion) => {
      if (sesion) {
        setAspirante({
          id: sesion.id,
          nombre: sesion.nombre,
          correo: sesion.correo,
          folio: sesion.folio,
          carreraNombre: sesion.carreraNombre,
        });
      } else {
        router.replace("/login");
      }
    });
  }, [aspirante, router]);

  const viewShotRef = useRef<ViewShotType>(null);

  const datosQR = aspirante ? `${aspirante.folio}|${aspirante.correo}` : "";

  const guardarQR = async () => {
    if (!aspirante) return;
    try {
      const resultado = await capturarYGuardarQR(viewShotRef, aspirante.folio);
      Alert.alert(resultado.ok ? "Guardado" : "Aviso", resultado.mensaje);
    } catch (error) {
      console.error("Error al guardar QR:", error);
      Alert.alert("Error", "No se pudo guardar el código QR.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {!aspirante ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons
            name="qr-code-outline"
            size={40}
            color={ColoresApp.primario}
          />
        </View>
      ) : (
        <ScrollView>
          <Header />
          <View style={styles.content}>
            <TarjetaQR qrData={datosQR} viewShotRef={viewShotRef} />
            <SizedBox height={32} />
            <DatosAspirante aspirante={aspirante} />
            <SizedBox height={32} />
            <Instrucciones />
            <SizedBox height={32} />
            <Pressable
              style={[styles.button, styles.buttonPrimary]}
              onPress={guardarQR}
            >
              <Ionicons
                name={
                  Platform.OS === "web" ? "download-outline" : "save-outline"
                }
                size={20}
                color="white"
              />
              <Text style={styles.buttonText}>
                {Platform.OS === "web" ? "Descargar QR" : "Guardar QR"}
              </Text>
            </Pressable>
            <SizedBox height={12} />
            <Pressable
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => router.back()}
            >
              <Ionicons
                name="arrow-back-outline"
                size={20}
                color={ColoresApp.primario}
              />
              <Text style={[styles.buttonText, { color: ColoresApp.primario }]}>
                Volver
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTES ---

const SizedBox = ({ height }: { height: number }) => (
  <View style={{ height }} />
);

const Header = () => (
  <LinearGradient
    colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
    style={styles.header}
  >
    <Ionicons name="qr-code-outline" color="white" size={40} />
    <SizedBox height={8} />
    <Text style={styles.headerText}>Escanea tu código QR en la sede</Text>
  </LinearGradient>
);

const TarjetaQR = ({
  qrData,
  viewShotRef,
}: {
  qrData: string;
  viewShotRef: React.RefObject<ViewShotType | null>;
}) => (
  <View style={styles.card}>
    <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
      <View style={styles.qrWrapper}>
        <QRCode value={qrData} size={220} />
      </View>
    </ViewShot>
    <SizedBox height={20} />
    <View style={styles.infoBox}>
      <Ionicons
        name="information-circle-outline"
        size={16}
        color={ColoresApp.primario}
      />
      <Text style={styles.infoText}>
        Escanea este código en la puerta de entrada
      </Text>
    </View>
  </View>
);

const DatosAspirante = ({ aspirante }: { aspirante: Aspirante }) => (
  <View style={styles.datosContainer}>
    <Text style={styles.datosTitle}>TUS DATOS</Text>
    <SizedBox height={16} />
    <FilaDato icon="person-outline" label="Nombre" valor={aspirante.nombre} />
    <SizedBox height={12} />
    <FilaDato icon="barcode-outline" label="Folio" valor={aspirante.folio} />
    <SizedBox height={12} />
    <FilaDato icon="mail-outline" label="Correo" valor={aspirante.correo} />
    <SizedBox height={12} />
    <FilaDato
      icon="school-outline"
      label="Carrera"
      valor={aspirante.carreraNombre}
    />
  </View>
);

const FilaDato = ({
  icon,
  label,
  valor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor: string;
}) => (
  <View style={styles.filaDato}>
    <Ionicons name={icon} size={20} color={ColoresApp.primario} />
    <View style={styles.filaDatoText}>
      <Text style={styles.filaDatoLabel}>{label}</Text>
      <Text style={styles.filaDatoValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  </View>
);

const Instrucciones = () => (
  <View
    style={[
      styles.instruccionesContainer,
      { backgroundColor: "#FBEFDD", borderColor: "#F3DDB3" },
    ]}
  >
    <View style={styles.instruccionesHeader}>
      <Ionicons
        name="information-circle-outline"
        color={ColoresApp.advertencia}
        size={20}
      />
      <Text style={styles.instruccionesTitle}>Cómo usar tu QR</Text>
    </View>
    <SizedBox height={12} />
    <PasoInstruccion numero="1" texto="Llega a la sede el día del examen" />
    <PasoInstruccion numero="2" texto="Presenta tu código QR en la entrada" />
    <PasoInstruccion
      numero="3"
      texto="Se registrará tu asistencia automáticamente"
    />
    <PasoInstruccion numero="4" texto="Procede a la sala de examen" />
  </View>
);

const PasoInstruccion = ({
  numero,
  texto,
}: {
  numero: string;
  texto: string;
}) => (
  <View style={styles.pasoContainer}>
    <View style={styles.pasoNumero}>
      <Text style={styles.pasoNumeroTexto}>{numero}</Text>
    </View>
    <Text style={styles.pasoTexto}>{texto}</Text>
  </View>
);

// --- ESTILOS ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  headerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  content: {
    padding: 24,
    alignItems: "center",
    marginTop: -40,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 560, // boxShadow: "0 4px 12px #0000001A",
    elevation: 5,
  },
  qrWrapper: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ColoresApp.primarioFondo,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: ColoresApp.primario,
    fontWeight: "500",
    textAlign: "center",
  },
  datosContainer: {
    backgroundColor: ColoresApp.fondo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 16,
    width: "100%",
    maxWidth: 560,
  },
  datosTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
    letterSpacing: 0.5,
  },
  filaDato: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  filaDatoText: {
    flex: 1,
    marginLeft: 12,
  },
  filaDatoLabel: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    fontWeight: "500",
  },
  filaDatoValor: {
    fontSize: 13,
    fontWeight: "600",
    color: ColoresApp.texto,
  },
  instruccionesContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 560,
  },
  instruccionesHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  instruccionesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ColoresApp.advertencia,
    marginLeft: 12,
  },
  pasoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
  },
  pasoNumero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ColoresApp.advertencia,
    justifyContent: "center",
    alignItems: "center",
  },
  pasoNumeroTexto: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  pasoTexto: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: "#78350F",
    lineHeight: 20,
    paddingTop: 4,
  },
  button: {
    width: "100%",
    maxWidth: 560,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: ColoresApp.primario,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: ColoresApp.primario,
  },
  buttonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
});
