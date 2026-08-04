import { CampoTexto } from "@/components/CampoTexto";
import { ColoresApp } from "@/constants/coloresApp";
import {
  obtenerAdministradorPorUsuario,
  solicitarRecuperacionPasswordAdmin,
} from "@/services/adminAuthServicio";
import { enviarCorreoRecuperacionPasswordAdmin } from "@/services/correoServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function PantallaRecuperarPasswordAdmin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [enviado, setEnviado] = useState(false);

  const solicitar = async () => {
    setMensajeError("");
    if (!correo.trim() || !correo.includes("@")) {
      setMensajeError("Ingresa un correo válido.");
      return;
    }

    setCargando(true);
    try {
      const token = await solicitarRecuperacionPasswordAdmin(correo);

      // Por seguridad, SIEMPRE mostramos el mismo mensaje de éxito, exista
      // o no ese correo como admin — así nadie puede usar este formulario
      // para averiguar qué correos son de administradores.
      if (token) {
        // Necesitamos el nombre del admin para personalizar el correo; si
        // esta consulta fallara, igual mandamos el correo con un saludo
        // genérico en vez de bloquear el flujo completo.
        const admin = await obtenerAdministradorPorUsuario({ correo });
        await enviarCorreoRecuperacionPasswordAdmin({
          nombre: admin?.nombre ?? "administrador",
          correo,
          token,
        });
      }

      setEnviado(true);
    } catch (e) {
      console.warn("Error en solicitar recuperación:", e);
      // Igual mostramos éxito por la misma razón de seguridad de arriba.
      setEnviado(true);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <Stack.Screen
        options={{
          title: "Recuperar contraseña",
          headerStyle: { backgroundColor: ColoresApp.oscuro },
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
          {enviado ? (
            <View style={styles.tarjetaExito}>
              <Ionicons
                name="mail-open-outline"
                size={48}
                color={ColoresApp.primario}
              />
              <Text style={styles.tituloExito}>Revisa tu correo</Text>
              <Text style={styles.textoExito}>
                Si ese correo pertenece a una cuenta de administrador, te
                mandamos un link para restablecer tu contraseña. Es válido por
                15 minutos.
              </Text>
              <Pressable
                onPress={() =>
                  router.push("/restablecer-password-admin")
                }
                style={styles.boton}
              >
                <Text style={styles.textoBoton}>Ya tengo mi código</Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/login-admin")}
                style={{ marginTop: 12 }}
              >
                <Text style={styles.enlace}>Volver al login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.contenidoTarjeta}>
              <Text style={styles.tituloTarjeta}>¿Olvidaste tu contraseña?</Text>
              <Text style={styles.subtituloTarjeta}>
                Ingresa el correo con el que entras al panel de administración.
              </Text>

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
                onPress={solicitar}
                disabled={cargando}
                style={({ pressed }) => [
                  styles.boton,
                  (cargando || pressed) && { opacity: 0.85 },
                ]}
              >
                {cargando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.textoBoton}>Enviar link →</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  textoError: { color: "#D64545", fontSize: 13, marginBottom: 12 },
  boton: {
    backgroundColor: ColoresApp.primario,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
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
  enlace: { color: ColoresApp.primario, fontSize: 14, fontWeight: "600" },
});
