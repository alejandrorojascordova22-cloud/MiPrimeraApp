import { ColoresApp } from "@/constants/coloresApp";
import {
    eliminarTokenPush,
    guardarTokenPush,
    obtenerTokensPorAspirante,
} from "@/services/pushRegistroServicio";
import {
    cerrarTodasLasSesiones,
    obtenerSesionAspirante,
} from "@/services/sesionServicio";
import {
    pedirPermisoNotificacionesWeb,
    permisoNotificacionesWeb,
    soportaNotificacionesWeb,
    suscribirPushWeb,
} from "@/services/webNotificacionesServicio";
import { obtenerTokenPushDispositivo } from "@/utils/pushDispositivo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

/**
 * Pantalla "Ajustes" del aspirante.
 * Antes el ítem del menú no hacía nada (era decorativo). Ahora reúne:
 * - datos con los que entró (folio/correo/nombre)
 * - notificaciones push reales (activa/desactiva registrando o borrando
 *   el token del dispositivo en la tabla push_tokens; el estado que ves
 *   siempre refleja lo que hay guardado en Supabase, no un valor inventado)
 * - modo oscuro para esta pantalla, guardado en AsyncStorage (persiste
 *   entre sesiones en este dispositivo). Aplicarlo a toda la app es un
 *   trabajo aparte porque cada una de las otras pantallas tiene sus
 *   propios estilos fijos; esto deja lista la base (clave de storage +
 *   patrón de colores) para cuando se quiera extender.
 * - accesos a soporte y cierre de sesión
 */

const CLAVE_MODO_OSCURO = "@ajustes_aspirante_modo_oscuro";

function confirmar(titulo: string, mensaje: string, onOk: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${titulo}\n${mensaje}`)) onOk();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: "Cancelar", style: "cancel" },
    { text: "Cerrar sesión", style: "destructive", onPress: onOk },
  ]);
}

function avisar(titulo: string, mensaje: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${titulo}\n${mensaje}`);
    return;
  }
  Alert.alert(titulo, mensaje);
}

// Paleta local de esta pantalla según el modo. El resto de la app sigue
// usando ColoresApp tal cual hasta que se decida hacerlo global.
function paletaLocal(oscuro: boolean) {
  return {
    fondo: oscuro ? "#0F1420" : ColoresApp.fondo,
    superficie: oscuro ? "#1A2032" : "#FFFFFF",
    borde: oscuro ? "#2A3148" : ColoresApp.borde,
    texto: oscuro ? "#F1F3F9" : ColoresApp.oscuro,
    textoSecundario: oscuro ? "#9199B5" : ColoresApp.textoSecundario,
    primario: ColoresApp.primario,
    primarioFondo: oscuro ? "#132038" : ColoresApp.primarioFondo,
  };
}

const Fila = ({
  icon,
  label,
  valor,
  colores,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor: string;
  colores: ReturnType<typeof paletaLocal>;
}) => (
  <View style={styles.fila}>
    <View
      style={[styles.iconoRedondo, { backgroundColor: colores.primarioFondo }]}
    >
      <Ionicons name={icon} size={15} color={colores.primario} />
    </View>
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={[styles.filaLabel, { color: colores.textoSecundario }]}>
        {label}
      </Text>
      <Text style={[styles.filaValor, { color: colores.texto }]}>{valor}</Text>
    </View>
  </View>
);

const FilaSwitch = ({
  icon,
  label,
  descripcion,
  valor,
  cargando,
  onValueChange,
  colores,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  descripcion?: string;
  valor: boolean;
  cargando?: boolean;
  onValueChange: (v: boolean) => void;
  colores: ReturnType<typeof paletaLocal>;
}) => (
  <View style={styles.fila}>
    <View
      style={[styles.iconoRedondo, { backgroundColor: colores.primarioFondo }]}
    >
      <Ionicons name={icon} size={15} color={colores.primario} />
    </View>
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={[styles.filaValor, { color: colores.texto }]}>{label}</Text>
      {!!descripcion && (
        <Text
          style={[
            styles.filaLabel,
            { color: colores.textoSecundario, marginTop: 2 },
          ]}
        >
          {descripcion}
        </Text>
      )}
    </View>
    {cargando ? (
      <ActivityIndicator size="small" color={colores.primario} />
    ) : (
      <Switch
        value={valor}
        onValueChange={onValueChange}
        trackColor={{ false: colores.borde, true: colores.primario }}
        thumbColor="#FFFFFF"
      />
    )}
  </View>
);

const Opcion = ({
  icon,
  texto,
  destructivo,
  onPress,
  colores,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  texto: string;
  destructivo?: boolean;
  onPress: () => void;
  colores: ReturnType<typeof paletaLocal>;
}) => (
  <Pressable style={styles.opcion} onPress={onPress}>
    <View
      style={[
        styles.iconoRedondo,
        {
          backgroundColor: destructivo
            ? "#3A1C1C" + "00"
            : colores.primarioFondo,
        },
        destructivo && { backgroundColor: "#FBEAEA" },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={destructivo ? "#DC2626" : colores.primario}
      />
    </View>
    <Text
      style={[
        styles.opcionTexto,
        { color: colores.texto },
        destructivo && { color: "#DC2626" },
      ]}
    >
      {texto}
    </Text>
    <Ionicons
      name="chevron-forward"
      size={16}
      color={colores.textoSecundario}
    />
  </Pressable>
);

export default function AjustesAspiranteScreen() {
  const router = useRouter();
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [aspiranteId, setAspiranteId] = useState<number | null>(null);

  const [modoOscuro, setModoOscuro] = useState(false);
  const [cargandoTema, setCargandoTema] = useState(true);

  const [notificacionesActivas, setNotificacionesActivas] = useState(false);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(true);
  const [actualizandoNotificaciones, setActualizandoNotificaciones] =
    useState(false);

  const colores = useMemo(() => paletaLocal(modoOscuro), [modoOscuro]);
  const iniciales = useMemo(() => {
    const partes = (nombre || "").trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "A";
    return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
  }, [nombre]);

  useEffect(() => {
    (async () => {
      const sesion = await obtenerSesionAspirante();
      if (sesion) {
        const id = Number((sesion as any).id) || null;
        setFolio((sesion as any).folio ?? "—");
        setCorreo((sesion as any).correo ?? "—");
        setNombre((sesion as any).nombre ?? "—");
        setAspiranteId(id);

        if (id) {
          try {
            if (Platform.OS === "web") {
              setNotificacionesActivas(
                soportaNotificacionesWeb() &&
                  permisoNotificacionesWeb() === "granted",
              );
            } else {
              const tokens = await obtenerTokensPorAspirante(id);
              setNotificacionesActivas(tokens.length > 0);
            }
          } catch {
            setNotificacionesActivas(false);
          } finally {
            setCargandoNotificaciones(false);
          }
        } else {
          setCargandoNotificaciones(false);
        }
      } else {
        setCargandoNotificaciones(false);
      }

      try {
        const guardado = await AsyncStorage.getItem(CLAVE_MODO_OSCURO);
        setModoOscuro(guardado === "1");
      } finally {
        setCargandoTema(false);
      }
    })();
  }, []);

  const alternarModoOscuro = async (valor: boolean) => {
    setModoOscuro(valor);
    try {
      await AsyncStorage.setItem(CLAVE_MODO_OSCURO, valor ? "1" : "0");
    } catch {
      // si falla el guardado, el modo sigue aplicado en esta sesión igual
    }
  };

  const alternarNotificaciones = async (valor: boolean) => {
    if (!aspiranteId) return;
    setActualizandoNotificaciones(true);
    try {
      if (Platform.OS === "web") {
        if (!soportaNotificacionesWeb()) {
          avisar(
            "No se pudo activar",
            "Este navegador no admite notificaciones push. Prueba con Chrome, Edge o Firefox actualizado.",
          );
          setNotificacionesActivas(false);
          return;
        }

        if (valor) {
          const permiso = await pedirPermisoNotificacionesWeb();
          if (permiso !== "granted") {
            avisar(
              "No se pudo activar",
              "Debes permitir las notificaciones en este navegador para activar los avisos.",
            );
            setNotificacionesActivas(false);
            return;
          }

          const ok = await suscribirPushWeb(aspiranteId);
          setNotificacionesActivas(ok);
          if (!ok) {
            avisar(
              "No se pudo activar",
              "Ocurrió un problema registrando tu suscripción web. Intenta de nuevo.",
            );
          }
          return;
        }

        setNotificacionesActivas(false);
        return;
      }

      if (valor) {
        const token = await obtenerTokenPushDispositivo();
        if (!token) {
          avisar(
            "No se pudo activar",
            "No conseguimos permiso o token de notificaciones en este dispositivo. Revisa los permisos de notificaciones en los ajustes de tu teléfono e inténtalo de nuevo.",
          );
          setNotificacionesActivas(false);
          return;
        }
        const ok = await guardarTokenPush({
          aspiranteId,
          token,
          plataforma: Platform.OS,
        });
        setNotificacionesActivas(ok);
        if (!ok) {
          avisar(
            "No se pudo activar",
            "Ocurrió un problema guardando tu preferencia. Intenta de nuevo.",
          );
        }
      } else {
        const tokens = await obtenerTokensPorAspirante(aspiranteId);
        for (const t of tokens) {
          await eliminarTokenPush(t);
        }
        setNotificacionesActivas(false);
      }
    } catch {
      avisar(
        "No se pudo actualizar",
        "Ocurrió un problema con tu conexión. Intenta de nuevo.",
      );
    } finally {
      setActualizandoNotificaciones(false);
    }
  };

  const salir = () => {
    confirmar(
      "¿Cerrar sesión?",
      "Vas a salir de tu cuenta en este dispositivo.",
      async () => {
        await cerrarTodasLasSesiones();
        router.replace("/login");
      },
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colores.fondo }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colores.superficie,
            borderBottomColor: colores.borde,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/perfil-aspirante")
          }
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color={colores.texto} />
        </Pressable>
        <Text style={[styles.topBarTitulo, { color: colores.texto }]}>
          Ajustes
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.perfilHeader}>
          <View style={[styles.avatar, { backgroundColor: colores.primario }]}>
            <Text style={styles.avatarTexto}>{iniciales}</Text>
          </View>
          <Text style={[styles.perfilNombre, { color: colores.texto }]}>
            {nombre || "—"}
          </Text>
          <Text
            style={[styles.perfilCorreo, { color: colores.textoSecundario }]}
          >
            {correo || "—"}
          </Text>
        </View>

        <Text style={[styles.seccionLabel, { color: colores.textoSecundario }]}>
          Tu cuenta
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}
        >
          <Fila
            icon="person-outline"
            label="Nombre"
            valor={nombre || "—"}
            colores={colores}
          />
          <View
            style={[styles.separador, { backgroundColor: colores.borde }]}
          />
          <Fila
            icon="barcode-outline"
            label="Folio"
            valor={folio || "—"}
            colores={colores}
          />
          <View
            style={[styles.separador, { backgroundColor: colores.borde }]}
          />
          <Fila
            icon="mail-outline"
            label="Correo"
            valor={correo || "—"}
            colores={colores}
          />
        </View>

        <Text style={[styles.seccionLabel, { color: colores.textoSecundario }]}>
          Preferencias
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}
        >
          <FilaSwitch
            icon="notifications-outline"
            label="Notificaciones push"
            descripcion="Avisos de asistencia, resultados y cronograma"
            valor={notificacionesActivas}
            cargando={cargandoNotificaciones || actualizandoNotificaciones}
            onValueChange={alternarNotificaciones}
            colores={colores}
          />
          <View
            style={[styles.separador, { backgroundColor: colores.borde }]}
          />
          <FilaSwitch
            icon="moon-outline"
            label="Modo oscuro"
            descripcion="Se aplica en esta pantalla y se recuerda en este dispositivo"
            valor={modoOscuro}
            cargando={cargandoTema}
            onValueChange={alternarModoOscuro}
            colores={colores}
          />
        </View>

        <Text style={[styles.seccionLabel, { color: colores.textoSecundario }]}>
          Sesión
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colores.superficie, borderColor: colores.borde },
          ]}
        >
          <Opcion
            icon="log-out-outline"
            texto="Cerrar sesión"
            destructivo
            onPress={salir}
            colores={colores}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  topBarTitulo: { fontSize: 16, fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  perfilHeader: { alignItems: "center", marginBottom: 8, marginTop: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarTexto: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  perfilNombre: { fontSize: 16, fontWeight: "700" },
  perfilCorreo: { fontSize: 12, marginTop: 2 },

  seccionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  separador: { height: 1 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  filaLabel: { fontSize: 11 },
  filaValor: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  iconoRedondo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12,
  },
  opcionTexto: { flex: 1, fontSize: 13, fontWeight: "600" },
});
