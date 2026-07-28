import { ColoresApp } from "@/constants/coloresApp";
import React, { createContext, useCallback, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Alert.alert(title, msg, [{text:"Cancelar"},{text:"Sí", onPress}]) NO
 * funciona en React Native Web: el navegador solo soporta window.alert /
 * window.confirm de un botón, así que los botones y su onPress se pierden
 * silenciosamente (no truena, simplemente no pasa nada al presionar).
 *
 * Este ConfirmProvider + useConfirm() reemplaza esos Alert.alert de
 * confirmación con un <Modal> real que funciona igual en iOS, Android y web.
 *
 * Uso:
 *   const confirmar = useConfirm();
 *   confirmar({
 *     titulo: "Eliminar aspirante",
 *     mensaje: "Esta acción no se puede deshacer.",
 *     textoConfirmar: "Sí, eliminar",
 *     destructivo: true,
 *     onConfirmar: async () => { ... },
 *   });
 */

interface OpcionesConfirm {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  destructivo?: boolean;
  onConfirmar: () => void | Promise<void>;
}

const ConfirmContext = createContext<((opts: OpcionesConfirm) => void) | null>(
  null,
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<
    (OpcionesConfirm & { visible: boolean }) | null
  >(null);

  const confirmar = useCallback((opts: OpcionesConfirm) => {
    setEstado({ ...opts, visible: true });
  }, []);

  const cerrar = () => setEstado(null);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal
        visible={!!estado?.visible}
        transparent
        animationType="fade"
        onRequestClose={cerrar}
      >
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <Text style={styles.titulo}>{estado?.titulo}</Text>
            <Text style={styles.mensaje}>{estado?.mensaje}</Text>
            <View style={styles.acciones}>
              <Pressable style={styles.botonCancelar} onPress={cerrar}>
                <Text style={styles.textoCancelar}>
                  {estado?.textoCancelar ?? "Cancelar"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.botonConfirmar,
                  {
                    backgroundColor: estado?.destructivo
                      ? "#DC3545"
                      : ColoresApp.primario,
                  },
                ]}
                onPress={async () => {
                  const accion = estado?.onConfirmar;
                  cerrar();
                  await accion?.();
                }}
              >
                <Text style={styles.textoConfirmar}>
                  {estado?.textoConfirmar ?? "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Hook para disparar el diálogo de confirmación desde cualquier pantalla. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      "useConfirm() debe usarse dentro de <ConfirmProvider>. Envuelve el _layout.tsx raíz con <ConfirmProvider>.",
    );
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  titulo: { fontSize: 18, fontWeight: "700", color: "#1A1A2E", marginBottom: 8 },
  mensaje: { fontSize: 14, color: "#555", lineHeight: 20 },
  acciones: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  botonCancelar: { paddingVertical: 10, paddingHorizontal: 16 },
  textoCancelar: { color: "#888", fontWeight: "600" },
  botonConfirmar: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  textoConfirmar: { color: "white", fontWeight: "700" },
});
