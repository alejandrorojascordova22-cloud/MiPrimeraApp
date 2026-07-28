import { ColoresApp } from "@/constants/coloresApp";
import {
  pedirPermisoNotificacionesWeb,
  permisoNotificacionesWeb,
  soportaNotificacionesWeb,
  suscribirPushWeb,
} from "@/services/webNotificacionesServicio";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Banner chico que aparece solo en web y solo si el usuario todavía no
 * decidió (permission === 'default'). Si acepta o rechaza, desaparece y
 * no vuelve a molestar en esta sesión.
 *
 * `aspiranteId`: si se pasa (pantallas de aspirante), además de pedir
 * permiso registra una suscripción real de Web Push (llega con el
 * navegador cerrado). En el panel de admin se puede omitir: ahí solo
 * queremos el permiso para `mostrarNotificacionWeb` con la pestaña abierta.
 */
export default function BannerPermisoNotificaciones({
  aspiranteId,
}: {
  aspiranteId?: number;
}) {
  const [visible, setVisible] = useState(() => {
    if (!soportaNotificacionesWeb()) {
      return false;
    }
    return permisoNotificacionesWeb() === "default";
  });

  useEffect(() => {
    if (!soportaNotificacionesWeb()) return;

    const permiso = permisoNotificacionesWeb();
    if (permiso === "granted" && aspiranteId) {
      suscribirPushWeb(aspiranteId);
    }
  }, [aspiranteId]);

  if (!visible) return null;

  const activar = async () => {
    const resultado = await pedirPermisoNotificacionesWeb();
    if (resultado === "granted" && aspiranteId) {
      await suscribirPushWeb(aspiranteId);
    }
    setVisible(false);
  };

  return (
    <View style={styles.banner}>
      <Ionicons
        name="notifications-outline"
        size={18}
        color={ColoresApp.primario}
      />
      <Text style={styles.texto}>
        ¿Quieres recibir notificaciones de avisos nuevos en este navegador?
      </Text>
      <Pressable style={styles.botonActivar} onPress={activar}>
        <Text style={styles.botonActivarTexto}>Activar</Text>
      </Pressable>
      <Pressable
        style={styles.botonCerrar}
        onPress={() => setVisible(false)}
        hitSlop={8}
      >
        <Ionicons name="close" size={16} color={ColoresApp.textoSecundario} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: ColoresApp.primarioFondo,
    borderWidth: 1,
    borderColor: ColoresApp.primario,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  texto: { flex: 1, fontSize: 12, color: ColoresApp.oscuro },
  botonActivar: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  botonActivarTexto: { color: "white", fontSize: 12, fontWeight: "600" },
  botonCerrar: { padding: 2 },
});
