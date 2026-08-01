import { CampoTexto } from "@/components/CampoTexto";
import { ColoresApp } from "@/constants/coloresApp";
import { obtenerAdministradorPorId } from "@/services/adminAuthServicio";
import {
  obtenerAspirantePorId,
  validarFolio,
} from "@/services/aspirantesServicio";
import {
  cerrarTodasLasSesiones,
  guardarSesionAspirante,
  obtenerSesionAdmin,
  obtenerSesionAspirante,
} from "@/services/sesionServicio";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

export default function LoginScreen() {
  const router = useRouter();
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");
  const [estasCargando, setEstasCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  // Revisa si ya existe una sesión al cargar la pantalla
  useEffect(() => {
    const verificarSesion = async () => {
      // Importante: no basta con que exista algo guardado en el celular.
      // Esa sesión local puede quedar "vieja" si el admin/aspirante fue
      // eliminado o desactivado en Supabase desde otro dispositivo (o
      // desde el propio panel) mientras esta app estaba cerrada. Por eso
      // aquí se revalida contra la base de datos antes de saltar a
      // /panel o /perfil-aspirante; si ya no es válida, se limpia la
      // sesión local y la persona se queda en el login (en vez de
      // rebotar a una pantalla que ya no puede cargar sus datos).
      const sesionAdmin = await obtenerSesionAdmin();
      if (sesionAdmin) {
        const adminVigente = await obtenerAdministradorPorId(sesionAdmin.id);
        if (adminVigente && adminVigente.activo !== false) {
          router.replace("/panel");
          return;
        }
        await cerrarTodasLasSesiones();
        setMensajeError(
          "Tu sesión ya no es válida (la cuenta fue eliminada o desactivada). Vuelve a iniciar sesión.",
        );
      }

      const sesionAspirante = await obtenerSesionAspirante();
      if (sesionAspirante) {
        const aspiranteVigente = await obtenerAspirantePorId(
          sesionAspirante.id,
        );
        if (aspiranteVigente) {
          router.replace("/perfil-aspirante");
          return;
        }
        await cerrarTodasLasSesiones();
        setMensajeError(
          "Tu sesión ya no es válida (el registro ya no existe). Vuelve a iniciar sesión.",
        );
      }
    };
    verificarSesion();
  }, [router]);

  // --- Lógica principal: validar el folio ---
  const iniciarExamen = async () => {
    if (!folio || !correo) {
      setMensajeError(
        "Debes ingresar el folio y correo asignados por el administrador.",
      );
      return;
    }
    if (!correo.includes("@")) {
      setMensajeError("Por favor ingresa un correo electrónico válido.");
      return;
    }

    setEstasCargando(true);
    setMensajeError("");

    try {
      const datosAspirante = await validarFolio({ folio, correo });
      if (datosAspirante) {
        // Limpia cualquier sesión previa (incluida una de admin que haya
        // quedado guardada) antes de iniciar la del aspirante, para que
        // no queden las dos activas a la vez.
        await cerrarTodasLasSesiones();
        // validarFolio devuelve la fila cruda de Supabase (snake_case:
        // carrera_id, carrera_nombre). El resto de la app (examen.tsx,
        // perfil-aspirante.tsx) espera camelCase (carreraId, carreraNombre)
        // en la sesión guardada, así que se mapea explícitamente aquí para
        // no volver a mandar "undefined" a obtenerPreguntas.
        await guardarSesionAspirante({
          ...datosAspirante,
          carreraId: datosAspirante.carrera_id ?? datosAspirante.carreraId,
          carreraNombre:
            datosAspirante.carrera_nombre ?? datosAspirante.carreraNombre,
        });
        router.replace("/perfil-aspirante");
      } else {
        setMensajeError("Folio o correo incorrectos. Revisa tus datos.");
      }
    } catch (error) {
      console.error("Error al iniciar examen:", error);
      setMensajeError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setEstasCargando(false);
    }
  };

  const irALoginAdmin = () => {
    router.push("/login-admin");
  };

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.areaEncabezado}>
            <Pressable
              onLongPress={irALoginAdmin}
              style={styles.logoContenedor}
            >
              <Ionicons name="school" color="white" size={22} />
            </Pressable>
            <Text style={styles.textoEncabezado}>
              Universidad Tecnológica de Oriental
            </Text>
            <Text style={styles.subtextoEncabezado}>
              Examen de admisión 2026
            </Text>
          </View>

          <View style={styles.tarjetaLogin}>
            <View style={styles.contenidoTarjeta}>
              <Text style={styles.tituloTarjeta}>Ingresa tu folio</Text>
              <Text style={styles.subtituloTarjeta}>
                Usa el folio y correo asignados.
              </Text>

              <CampoTexto
                etiqueta="FOLIO"
                placeholder="UTO-2026-XXXX"
                icono="person-outline"
                valor={folio}
                onChangeText={setFolio}
              />

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
                onPress={iniciarExamen}
                disabled={estasCargando}
                style={({ pressed }) => [
                  styles.boton,
                  (estasCargando || pressed) && { opacity: 0.85 },
                ]}
              >
                {estasCargando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.textoBoton}>Iniciar examen →</Text>
                )}
              </Pressable>

              <View style={styles.notaPrivacidad}>
                <Ionicons
                  name="shield-checkmark-outline"
                  color={ColoresApp.primario}
                  size={16}
                />
                <Text style={styles.textoNotaPrivacidad}>
                  Tu resultado solo llegará a tu correo.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedorPrincipal: {
    flex: 1,
    backgroundColor: "transparent",
  },
  areaEncabezado: {
    backgroundColor: ColoresApp.oscuro,
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 56,
    alignItems: "center",
  },
  logoContenedor: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  textoEncabezado: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  subtextoEncabezado: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    marginTop: 4,
  },
  tarjetaLogin: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    marginTop: -22,
    padding: 24,
    alignItems: "center",
  },
  contenidoTarjeta: {
    width: "100%",
    maxWidth: 480,
  },
  tituloTarjeta: {
    fontSize: 20,
    fontWeight: "700",
    color: ColoresApp.oscuro,
  },
  subtituloTarjeta: {
    color: ColoresApp.textoSecundario,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 22,
  },
  textoError: {
    color: "#D64545",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  boton: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  textoBoton: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  notaPrivacidad: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ColoresApp.primarioFondo,
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  textoNotaPrivacidad: {
    flex: 1,
    fontSize: 12,
    color: "#0C447C",
    lineHeight: 17,
  },
});