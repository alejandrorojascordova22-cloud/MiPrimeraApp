import { CampoTexto } from "@/components/CampoTexto";
import { ColoresApp } from "@/constants/coloresApp";
import { restablecerPasswordAdmin } from "@/services/adminAuthServicio";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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

export default function PantallaRestablecerPasswordAdmin() {
  const router = useRouter();
  // Si se abrió desde el link del correo (miprimeraapp://restablecer-password-admin?token=...),
  // el token ya llega precargado aquí. Si no, el admin lo pega a mano.
  const { token: tokenDeLink } = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(tokenDeLink ?? "");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");
  const [exito, setExito] = useState(false);

  const restablecer = async () => {
    setMensajeError("");

    if (!token.trim()) {
      setMensajeError("Pega o escribe el código que te llegó por correo.");
      return;
    }
    if (nuevaContrasena.length < 6) {
      setMensajeError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      setMensajeError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const ok = await restablecerPasswordAdmin(token, nuevaContrasena);
      if (ok) {
        setExito(true);
      } else {
        setMensajeError(
          "El link/código ya no es válido (caducó, ya se usó, o está mal escrito). Solicita uno nuevo.",
        );
      }
    } catch (e) {
      console.warn("Error al restablecer contraseña:", e);
      setMensajeError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <Stack.Screen
        options={{
          title: "Nueva contraseña",
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
          {exito ? (
            <View style={styles.tarjetaExito}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={ColoresApp.primario}
              />
              <Text style={styles.tituloExito}>Contraseña actualizada</Text>
              <Text style={styles.textoExito}>
                Ya puedes iniciar sesión con tu nueva contraseña.
              </Text>
              <Pressable
                onPress={() => router.replace("/login-admin")}
                style={styles.boton}
              >
                <Text style={styles.textoBoton}>Ir al login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.contenidoTarjeta}>
              <Text style={styles.tituloTarjeta}>Restablecer contraseña</Text>
              <Text style={styles.subtituloTarjeta}>
                {tokenDeLink
                  ? "Confirma tu nueva contraseña para terminar."
                  : "Pega aquí el código que te llegó por correo."}
              </Text>

              <CampoTexto
                etiqueta="CÓDIGO"
                placeholder="Pega el código del correo"
                icono="key-outline"
                valor={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={{ height: 4 }} />

              <CampoTexto
                etiqueta="NUEVA CONTRASEÑA"
                placeholder="••••••••"
                icono="lock-closed-outline"
                valor={nuevaContrasena}
                onChangeText={setNuevaContrasena}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoCorrect={false}
                iconoFinal={verContrasena ? "eye-off-outline" : "eye-outline"}
                onPressIconoFinal={() => setVerContrasena(!verContrasena)}
              />

              <View style={{ height: 4 }} />

              <CampoTexto
                etiqueta="CONFIRMAR CONTRASEÑA"
                placeholder="••••••••"
                icono="lock-closed-outline"
                valor={confirmarContrasena}
                onChangeText={setConfirmarContrasena}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {mensajeError ? (
                <Text style={styles.textoError}>{mensajeError}</Text>
              ) : null}

              <Pressable
                onPress={restablecer}
                disabled={cargando}
                style={({ pressed }) => [
                  styles.boton,
                  (cargando || pressed) && { opacity: 0.85 },
                ]}
              >
                {cargando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.textoBoton}>Guardar nueva contraseña</Text>
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
});
