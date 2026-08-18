import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { enviarCorreoResultado } from "@/services/correoServicio";
import { obtenerSesionAspirante } from "@/services/sesionServicio";

const ColoresApp = {
  primario: "#0055A4",
  secundario: "#0B1C30",
  exito: "#2E7D32",
  error: "#D32F2F",
  advertencia: "#F57C00",
  fondo: "#F5F7FA",
  blanco: "#FFFFFF",
  gris: "#E5E7EB",
  texto: "#374151",
};

function formatDateTime(date: Date) {
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Aspirante = {
  id: number;
  nombre: string;
  correo: string;
  folio: string;
  carreraNombre: string;
};

export default function PantallaResultado() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    aspirante?: string;
    aciertos?: string;
    total?: string;
    calificacion?: string;
    estado?: "terminado" | "en_revision";
    fechaEnvio?: string;
    fechaInicio?: string;
    fechaFin?: string;
  }>();

  const [aspirante, setAspirante] = useState<Aspirante | null>(
    params.aspirante ? JSON.parse(params.aspirante) : null,
  );

  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  const aciertos = Number(params.aciertos ?? 0);
  const total = Number(params.total ?? 0);
  const calificacion = Number(params.calificacion ?? 0);

  const fechaEnvio = params.fechaEnvio ? new Date(params.fechaEnvio) : null;
  const fechaInicio = params.fechaInicio ? new Date(params.fechaInicio) : null;
  const fechaFin = params.fechaFin ? new Date(params.fechaFin) : null;

  const enRevision = params.estado === "en_revision";
  const aprobado = calificacion >= 70;

  useEffect(() => {
    if (aspirante) return;

    obtenerSesionAspirante().then((sesion) => {
      if (!sesion) return;

      setAspirante({
        id: sesion.id,
        nombre: sesion.nombre,
        correo: sesion.correo,
        folio: sesion.folio,
        carreraNombre: sesion.carreraNombre,
      });
    });
  }, [aspirante]);

  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        router.replace("/login");
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        backAction,
      );

      return () => subscription.remove();
    }, [router]),
  );

  async function enviarResultadoCorreo() {
    if (!aspirante) return;

    try {
      setEnviandoCorreo(true);

      const enviado = await enviarCorreoResultado({
        nombre: aspirante.nombre,
        correo: aspirante.correo,
        calificacion,
        aciertos,
        total,
      });

      if (enviado) {
        setCorreoEnviado(true);

        Alert.alert(
          "Correo enviado",
          "El resultado fue enviado correctamente.",
        );
      } else {
        Alert.alert("Error", "No fue posible enviar el correo.");
      }
    } catch {
      Alert.alert("Error", "Ocurrió un problema al enviar el correo.");
    } finally {
      setEnviandoCorreo(false);
    }
  }

  const colorEstado = enRevision
    ? ColoresApp.advertencia
    : aprobado
      ? ColoresApp.exito
      : ColoresApp.error;

  const icono = enRevision
    ? "time"
    : aprobado
      ? "checkmark-circle"
      : "close-circle";

  const fechaEnvioTexto = fechaEnvio
    ? formatDateTime(fechaEnvio)
    : "No disponible";
  const fechaInicioTexto = fechaInicio
    ? formatDateTime(fechaInicio)
    : "No disponible";
  const fechaFinTexto = fechaFin ? formatDateTime(fechaFin) : "No disponible";

  const estadoTexto = enRevision
    ? "En revisión"
    : aprobado
      ? "Aprobado"
      : "Reprobado";

  const mensajeCompartir = aspirante
    ? `Resultado de examen:\n\nNombre: ${aspirante.nombre}\nCarrera: ${aspirante.carreraNombre}\nFolio: ${aspirante.folio}\nEstado: ${estadoTexto}\nCalificación: ${calificacion}%\nAciertos: ${aciertos} de ${total}\nFecha de envío: ${fechaEnvioTexto}`
    : "Resultado de examen.";

  async function compartirResultado() {
    try {
      await Share.share({
        message: mensajeCompartir,
      });
    } catch (error) {
      console.warn("Error al compartir resultado:", error);
      Alert.alert("Error", "No se pudo compartir el resultado.");
    }
  }

  const titulo = enRevision
    ? "Examen en revisión"
    : aprobado
      ? "¡Felicidades!"
      : "Resultado del examen";

  if (!aspirante) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={ColoresApp.primario} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView>
        <LinearGradient
          colors={[ColoresApp.primario, ColoresApp.primario]}
          style={styles.header}
        >
          <SafeAreaView>
            <Ionicons name={icono} size={70} color="white" />

            <Text style={styles.titulo}>{titulo}</Text>

            <Text style={styles.subtitulo}>
              Resultado del examen de admisión
            </Text>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.cardBandeja}>
            <Text style={styles.bandejaTitulo}>Bandeja de resultados</Text>
            <View style={styles.bandejaFila}>
              <View style={styles.bandejaItem}>
                <Text style={styles.bandejaLabel}>Folio</Text>
                <Text style={styles.bandejaValor}>{aspirante.folio}</Text>
              </View>
              <View style={styles.bandejaItem}>
                <Text style={styles.bandejaLabel}>Estado</Text>
                <Text style={[styles.bandejaValor, { color: colorEstado }]}>
                  {estadoTexto}
                </Text>
              </View>
            </View>
            <View style={styles.bandejaFila}>
              <View style={styles.bandejaItem}>
                <Text style={styles.bandejaLabel}>Inicio</Text>
                <Text style={styles.bandejaValor}>{fechaInicioTexto}</Text>
              </View>
              <View style={styles.bandejaItem}>
                <Text style={styles.bandejaLabel}>Fin</Text>
                <Text style={styles.bandejaValor}>{fechaFinTexto}</Text>
              </View>
            </View>
            <View style={styles.bandejaFila}>
              <View style={styles.bandejaItemFull}>
                <Text style={styles.bandejaLabel}>Enviado</Text>
                <Text style={styles.bandejaValor}>{fechaEnvioTexto}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardResultado}>
            {enRevision ? (
              <>
                <Ionicons
                  name="time"
                  color={ColoresApp.advertencia}
                  size={60}
                />

                <Text style={styles.revisionTitulo}>
                  Tu examen será revisado manualmente
                </Text>

                <Text style={styles.revisionTexto}>
                  Algunas preguntas requieren revisión por parte del comité
                  académico.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>CALIFICACIÓN</Text>

                <Text style={[styles.calificacion, { color: colorEstado }]}>
                  {calificacion}%
                </Text>

                <View style={styles.linea} />

                <View style={styles.estadisticas}>
                  <View style={styles.estadistica}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={28}
                      color={ColoresApp.exito}
                    />

                    <Text style={styles.valor}>{aciertos}</Text>

                    <Text style={styles.etiqueta}>Aciertos</Text>
                  </View>

                  <View style={styles.estadistica}>
                    <Ionicons
                      name="help-circle-outline"
                      size={28}
                      color={ColoresApp.primario}
                    />

                    <Text style={styles.valor}>{total}</Text>

                    <Text style={styles.etiqueta}>Preguntas</Text>
                  </View>

                  <View style={styles.estadistica}>
                    <Ionicons
                      name="close-circle-outline"
                      size={28}
                      color={ColoresApp.error}
                    />

                    <Text style={styles.valor}>{total - aciertos}</Text>

                    <Text style={styles.etiqueta}>Errores</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.seccionTitulo}>Datos del Aspirante</Text>

            <View style={styles.item}>
              <Ionicons name="person" size={20} color={ColoresApp.primario} />

              <View style={styles.itemTexto}>
                <Text style={styles.itemLabel}>Nombre</Text>

                <Text style={styles.itemValor}>{aspirante.nombre}</Text>
              </View>
            </View>

            <View style={styles.item}>
              <Ionicons name="school" size={20} color={ColoresApp.primario} />

              <View style={styles.itemTexto}>
                <Text style={styles.itemLabel}>Carrera</Text>

                <Text style={styles.itemValor}>{aspirante.carreraNombre}</Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.informacion,
              {
                borderLeftColor: colorEstado,
              },
            ]}
          >
            <Text
              style={[
                styles.infoTitulo,
                {
                  color: colorEstado,
                },
              ]}
            >
              {enRevision
                ? "Información"
                : aprobado
                  ? "Próximos pasos"
                  : "Recomendaciones"}
            </Text>

            <Text style={styles.infoTexto}>
              {enRevision
                ? "Tu examen será revisado por el comité académico. Una vez concluido el proceso recibirás el resultado definitivo por correo electrónico."
                : aprobado
                  ? "Has aprobado el examen de admisión. Permanece atento a tu correo para conocer las siguientes etapas del proceso."
                  : "No alcanzaste la calificación mínima requerida. Te recomendamos prepararte y participar en el siguiente proceso de admisión."}
            </Text>
          </View>

          <View style={styles.botonesContainer}>
            <Pressable
              style={styles.botonPrimario}
              onPress={compartirResultado}
            >
              <Ionicons name="share-social" color="#FFF" size={20} />
              <Text style={styles.textoBoton}>Compartir resultado</Text>
            </Pressable>

            {!enRevision && (
              <Pressable
                style={[styles.botonSecundario, styles.botonMargen]}
                disabled={correoEnviado || enviandoCorreo}
                onPress={enviarResultadoCorreo}
              >
                {enviandoCorreo ? (
                  <ActivityIndicator color={ColoresApp.primario} />
                ) : (
                  <>
                    <Ionicons
                      name={correoEnviado ? "checkmark" : "mail"}
                      color={ColoresApp.primario}
                      size={20}
                    />

                    <Text style={styles.textoSecundario}>
                      {correoEnviado ? "Correo enviado" : "Enviar correo"}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.botonSecundario}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.textoSecundario}>Finalizar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },

  header: {
    height: 250,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
  },

  titulo: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
  },

  subtitulo: {
    marginTop: 8,
    fontSize: 15,
    color: "#E8F0FE",
    textAlign: "center",
  },

  body: {
    marginTop: -30,
    backgroundColor: "#FFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
  },

  cardResultado: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    alignItems: "center",
  },

  card: {
    marginTop: 20,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  label: {
    color: "#6B7280",
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 12,
  },

  calificacion: {
    marginTop: 12,
    fontSize: 70,
    fontWeight: "bold",
  },

  linea: {
    marginVertical: 20,
    width: "100%",
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  estadisticas: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
  },

  estadistica: {
    alignItems: "center",
    flex: 1,
  },

  valor: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  etiqueta: {
    marginTop: 5,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },

  revisionTitulo: {
    marginTop: 15,
    fontSize: 18,
    textAlign: "center",
    fontWeight: "bold",
    color: "#111827",
  },

  revisionTexto: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },

  seccionTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 18,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  itemTexto: {
    marginLeft: 12,
    flex: 1,
  },

  itemLabel: {
    color: "#6B7280",
    fontSize: 12,
  },

  itemValor: {
    marginTop: 2,
    fontWeight: "700",
    color: "#111827",
    fontSize: 16,
  },

  informacion: {
    marginTop: 20,
    backgroundColor: "#F9FAFB",
    borderLeftWidth: 6,
    borderRadius: 12,
    padding: 18,
  },

  infoTitulo: {
    fontWeight: "bold",
    fontSize: 17,
  },

  infoTexto: {
    marginTop: 10,
    lineHeight: 24,
    fontSize: 14,
    color: "#374151",
  },

  botonPrimario: {
    marginTop: 25,
    backgroundColor: ColoresApp.primario,
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  textoBoton: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 10,
  },

  cardBandeja: {
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    marginBottom: 20,
  },

  bandejaTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: ColoresApp.primario,
    marginBottom: 14,
  },

  bandejaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  bandejaItem: {
    flex: 1,
    marginRight: 12,
  },

  bandejaItemFull: {
    flex: 1,
  },

  bandejaLabel: {
    color: "#6B7280",
    fontSize: 12,
    marginBottom: 4,
  },

  bandejaValor: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  botonesContainer: {
    marginTop: 25,
  },

  botonMargen: {
    marginTop: 12,
  },

  botonSecundario: {
    marginTop: 15,
    height: 55,
    borderWidth: 2,
    borderColor: ColoresApp.primario,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  textoSecundario: {
    color: ColoresApp.primario,
    fontWeight: "bold",
    fontSize: 16,
  },
});