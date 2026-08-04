import { CampoTexto } from "@/components/CampoTexto";
import { ColoresApp } from "@/constants/coloresApp";
import { buscarAspirantePorRecuperacion } from "@/services/aspirantesServicio";
import { obtenerCarreras } from "@/services/carrerasServicio";
import { enviarCorreoRecuperacionFolio } from "@/services/correoServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// TODO: reemplazar por el número real de soporte (con código de país, sin
// espacios ni signos, ej. 521XXXXXXXXXX).
const WHATSAPP_SOPORTE = "522202678971";

type Carrera = { id: number; nombre: string };

export default function PantallaRecuperarFolio() {
  const router = useRouter();

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargandoCarreras, setCargandoCarreras] = useState(true);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const [nombre, setNombre] = useState("");
  const [carreraSeleccionada, setCarreraSeleccionada] =
    useState<Carrera | null>(null);
  const [correo, setCorreo] = useState("");

  const [estaCargando, setEstaCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [exito, setExito] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const datos = await obtenerCarreras();
      setCarreras(datos.map((c) => ({ id: c.id, nombre: c.nombre })));
      setCargandoCarreras(false);
    };
    cargar();
  }, []);

  const buscarFolio = async () => {
    setMensajeError("");
    setExito(false);
    setNoEncontrado(false);

    if (!nombre.trim() || !carreraSeleccionada || !correo.trim()) {
      setMensajeError("Completa tu nombre, carrera y correo.");
      return;
    }
    if (!correo.includes("@")) {
      setMensajeError("Ingresa un correo electrónico válido.");
      return;
    }

    setEstaCargando(true);
    try {
      const aspirante = await buscarAspirantePorRecuperacion({
        nombre,
        idCarrera: carreraSeleccionada.id,
        correo,
      });

      if (!aspirante) {
        setNoEncontrado(true);
        return;
      }

      const enviado = await enviarCorreoRecuperacionFolio({
        nombre: aspirante.nombre,
        correo: aspirante.correo,
        folio: aspirante.folio,
        carrera: aspirante.carrera_nombre ?? carreraSeleccionada.nombre,
      });

      if (enviado) {
        setExito(true);
      } else {
        setMensajeError(
          "No se pudo enviar el correo en este momento. Inténtalo de nuevo en unos minutos.",
        );
      }
    } catch (e) {
      console.warn("Error en buscarFolio:", e);
      setMensajeError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setEstaCargando(false);
    }
  };

  const abrirWhatsapp = () => {
    Linking.openURL(
      `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(
        "Hola, necesito ayuda para recuperar mi folio del examen de admisión.",
      )}`,
    );
  };

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <Stack.Screen
        options={{
          title: "Recuperar mi folio",
          headerStyle: { backgroundColor: ColoresApp.primario },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "600" },
          headerTitleAlign: "center",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
          {exito ? (
            <View style={styles.tarjetaExito}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={ColoresApp.primario}
              />
              <Text style={styles.tituloExito}>¡Listo!</Text>
              <Text style={styles.textoExito}>
                Te enviamos tu folio y carrera al correo registrado. Revisa tu
                bandeja de entrada (y spam, por si acaso).
              </Text>
              <Pressable
                onPress={() => router.replace("/login")}
                // ruta del login del aspirante, sin cambios
                style={styles.boton}
              >
                <Text style={styles.textoBoton}>Volver a iniciar sesión</Text>
              </Pressable>
            </View>
          ) : noEncontrado ? (
            <View style={styles.tarjetaExito}>
              <Ionicons
                name="alert-circle"
                size={48}
                color="#D97706"
              />
              <Text style={styles.tituloExito}>No encontramos coincidencia</Text>
              <Text style={styles.textoExito}>
                Revisa que tu nombre, carrera y correo sean exactamente los
                que usaste al registrarte. Si sigue sin funcionar, contáctanos
                por WhatsApp y con gusto te ayudamos.
              </Text>
              <Pressable onPress={abrirWhatsapp} style={styles.botonWhatsapp}>
                <Ionicons name="logo-whatsapp" size={20} color="white" />
                <Text style={styles.textoBoton}>Contactar soporte</Text>
              </Pressable>
              <Pressable
                onPress={() => setNoEncontrado(false)}
                style={{ marginTop: 12 }}
              >
                <Text style={styles.enlaceReintentar}>
                  Volver a intentar
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.contenidoTarjeta}>
              <Text style={styles.tituloTarjeta}>¿Olvidaste tu folio?</Text>
              <Text style={styles.subtituloTarjeta}>
                Ingresa tu nombre completo, carrera y correo tal como los
                usaste al registrarte. Te reenviaremos tu folio por correo.
              </Text>

              <CampoTexto
                etiqueta="NOMBRE COMPLETO"
                placeholder="Como te registraste"
                icono="person-outline"
                valor={nombre}
                onChangeText={setNombre}
              />

              <Text style={styles.etiquetaSelector}>CARRERA</Text>
              <Pressable
                style={styles.selector}
                onPress={() => setSelectorAbierto(true)}
                disabled={cargandoCarreras}
              >
                <Ionicons
                  name="school-outline"
                  size={20}
                  color="#8A94A6"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={
                    carreraSeleccionada
                      ? styles.selectorTexto
                      : styles.selectorPlaceholder
                  }
                >
                  {cargandoCarreras
                    ? "Cargando carreras…"
                    : carreraSeleccionada?.nombre ?? "Selecciona tu carrera"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#8A94A6" />
              </Pressable>

              <View style={{ height: 4 }} />

              <CampoTexto
                etiqueta="CORREO"
                placeholder="tu@correo.com"
                icono="mail-outline"
                valor={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {mensajeError ? (
                <Text style={styles.textoError}>{mensajeError}</Text>
              ) : null}

              <Pressable
                onPress={buscarFolio}
                disabled={estaCargando}
                style={({ pressed }) => [
                  styles.boton,
                  (estaCargando || pressed) && { opacity: 0.85 },
                ]}
              >
                {estaCargando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.textoBoton}>Enviarme mi folio →</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={selectorAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorAbierto(false)}
      >
        <Pressable
          style={styles.modalFondo}
          onPress={() => setSelectorAbierto(false)}
        >
          <View style={styles.modalContenido}>
            {carreras.map((c) => (
              <Pressable
                key={c.id}
                style={styles.opcionCarrera}
                onPress={() => {
                  setCarreraSeleccionada(c);
                  setSelectorAbierto(false);
                }}
              >
                <Text style={styles.opcionCarreraTexto}>{c.nombre}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedorPrincipal: { flex: 1, backgroundColor: "white" },
  contenidoTarjeta: { width: "100%", maxWidth: 480, alignSelf: "center" },
  tituloTarjeta: {
    fontSize: 20,
    fontWeight: "700",
    color: ColoresApp.texto,
    marginBottom: 6,
  },
  subtituloTarjeta: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
    lineHeight: 20,
  },
  etiquetaSelector: {
    fontSize: 14,
    fontWeight: "600",
    color: ColoresApp.texto,
    marginBottom: 6,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  selectorTexto: { flex: 1, fontSize: 16, color: ColoresApp.texto },
  selectorPlaceholder: { flex: 1, fontSize: 16, color: "#8A94A6" },
  textoError: { color: "#D64545", fontSize: 13, marginBottom: 12 },
  boton: {
    backgroundColor: ColoresApp.primario,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  botonWhatsapp: {
    flexDirection: "row",
    backgroundColor: "#25D366",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  textoBoton: { color: "white", fontSize: 16, fontWeight: "700" },
  tarjetaExito: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  tituloExito: {
    fontSize: 20,
    fontWeight: "700",
    color: ColoresApp.texto,
    marginTop: 12,
    marginBottom: 8,
  },
  textoExito: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  enlaceReintentar: {
    color: ColoresApp.primario,
    fontSize: 14,
    fontWeight: "600",
  },
  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalContenido: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 8,
    maxHeight: "60%",
  },
  opcionCarrera: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },
  opcionCarreraTexto: { fontSize: 16, color: ColoresApp.texto },
});
