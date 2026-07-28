import { ColoresApp } from "@/constants/coloresApp";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

/**
 * Campo de fecha y hora real y multiplataforma.
 *
 * `SelectorFecha` (el componente anterior) era solo un marcador de
 * posición: un <Pressable> sin onPress, así que tocar el "calendario" no
 * hacía absolutamente nada. Este componente sí funciona:
 *   - Se puede escribir la fecha/hora a mano, sin forzar ningún formato
 *     mientras se escribe (no bloquea el tecleo si "no se ve como fecha").
 *   - O se puede abrir un calendario propio (sin librerías nativas, por
 *     eso funciona igual en web, iOS y Android/Expo Go) con selector de
 *     hora y minuto con steppers +/-.
 *
 * Guarda el valor como "AAAA-MM-DDTHH:mm" (mismo formato que ya usa
 * gestionar-preguntas.tsx), para que se pueda pasar directo a `new Date()`.
 */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatearLegible(valor: string) {
  if (!valor) return "";
  const [fecha, hora] = valor.split("T");
  const [y, m, d] = (fecha || "").split("-").map(Number);
  if (!y || !m || !d) return valor;
  const base = `${d} de ${MESES[m - 1]} de ${y}`;
  return hora ? `${base}, ${hora}` : base;
}

export default function CampoFechaHora({
  etiqueta,
  valor,
  onCambiar,
  colorAcento,
  opcional,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  colorAcento?: string;
  opcional?: boolean;
}) {
  const acento = colorAcento || ColoresApp.primario;

  const [visible, setVisible] = useState(false);
  const [mesActual, setMesActual] = useState(new Date().getMonth());
  const [anioActual, setAnioActual] = useState(new Date().getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  const [hora, setHora] = useState(12);
  const [minuto, setMinuto] = useState(0);

  const abrirCalendario = () => {
    const [fechaParte, horaParte] = (valor || "").split("T");
    const partes = (fechaParte || "").split("-").map(Number);
    const base =
      partes.length === 3 && partes[0]
        ? new Date(partes[0], partes[1] - 1, partes[2])
        : new Date();
    setMesActual(base.getMonth());
    setAnioActual(base.getFullYear());
    setDiaSeleccionado(partes.length === 3 && partes[0] ? partes[2] : null);
    if (horaParte) {
      const [h, min] = horaParte.split(":").map(Number);
      setHora(Number.isFinite(h) ? h : 12);
      setMinuto(Number.isFinite(min) ? min : 0);
    } else {
      setHora(12);
      setMinuto(0);
    }
    setVisible(true);
  };

  const cambiarMes = (delta: number) => {
    let m = mesActual + delta;
    let a = anioActual;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMesActual(m);
    setAnioActual(a);
  };

  const ajustarHora = (delta: number) => setHora((h) => (h + delta + 24) % 24);
  const ajustarMinuto = (delta: number) => setMinuto((m) => (m + delta + 60) % 60);

  const aplicar = () => {
    if (diaSeleccionado == null) {
      setVisible(false);
      return;
    }
    const nuevo = `${anioActual}-${pad2(mesActual + 1)}-${pad2(diaSeleccionado)}T${pad2(hora)}:${pad2(minuto)}`;
    onCambiar(nuevo);
    setVisible(false);
  };

  const limpiar = () => {
    onCambiar("");
    setVisible(false);
  };

  const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay();
  const diasDelMes = new Date(anioActual, mesActual + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];
  const filas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7));

  const hoy = new Date();
  const esHoy = (dia: number) =>
    dia === hoy.getDate() && mesActual === hoy.getMonth() && anioActual === hoy.getFullYear();

  return (
    <View>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={valor}
          onChangeText={onCambiar}
          placeholder={opcional ? "Opcional: AAAA-MM-DD HH:mm" : "AAAA-MM-DD HH:mm"}
          placeholderTextColor={ColoresApp.textoSecundario}
        />
        <Pressable
          style={[styles.botonCalendario, { borderColor: acento, backgroundColor: `${acento}14` }]}
          onPress={abrirCalendario}
          hitSlop={6}
        >
          <Ionicons name="calendar-outline" size={18} color={acento} />
        </Pressable>
      </View>
      {!!valor && <Text style={styles.hint}>{formatearLegible(valor)}</Text>}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Pressable onPress={() => cambiarMes(-1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={ColoresApp.oscuro} />
              </Pressable>
              <Text style={styles.headerTexto}>{MESES[mesActual]} {anioActual}</Text>
              <Pressable onPress={() => cambiarMes(1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={20} color={ColoresApp.oscuro} />
              </Pressable>
            </View>

            <View style={styles.filaSemana}>
              {DIAS_SEMANA.map((d, i) => (
                <Text key={i} style={styles.diaSemana}>{d}</Text>
              ))}
            </View>

            {filas.map((fila, i) => (
              <View key={i} style={styles.fila}>
                {fila.map((dia, j) =>
                  dia === null ? (
                    <View key={j} style={styles.celda} />
                  ) : (
                    <Pressable
                      key={j}
                      style={[
                        styles.celda,
                        styles.celdaTocable,
                        diaSeleccionado === dia && { backgroundColor: acento },
                      ]}
                      onPress={() => setDiaSeleccionado(dia)}
                    >
                      <Text
                        style={[
                          styles.celdaTexto,
                          esHoy(dia) && diaSeleccionado !== dia && { color: acento, fontWeight: "700" },
                          diaSeleccionado === dia && { color: "white", fontWeight: "700" },
                        ]}
                      >
                        {dia}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            ))}

            <View style={styles.horaFila}>
              <Text style={styles.horaLabel}>Hora</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => ajustarHora(-1)} hitSlop={8} style={styles.stepperBoton}>
                  <Ionicons name="remove" size={16} color={ColoresApp.oscuro} />
                </Pressable>
                <Text style={styles.stepperValor}>{pad2(hora)}:{pad2(minuto)}</Text>
                <Pressable onPress={() => ajustarHora(1)} hitSlop={8} style={styles.stepperBoton}>
                  <Ionicons name="add" size={16} color={ColoresApp.oscuro} />
                </Pressable>
              </View>
              <View style={styles.stepper}>
                <Pressable onPress={() => ajustarMinuto(-5)} hitSlop={8} style={styles.stepperBoton}>
                  <Ionicons name="remove" size={16} color={ColoresApp.oscuro} />
                </Pressable>
                <Text style={styles.horaLabel}>min</Text>
                <Pressable onPress={() => ajustarMinuto(5)} hitSlop={8} style={styles.stepperBoton}>
                  <Ionicons name="add" size={16} color={ColoresApp.oscuro} />
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              {opcional && (
                <Pressable style={[styles.botonCerrar, { flex: 1 }]} onPress={limpiar}>
                  <Text style={styles.botonCerrarTexto}>Quitar</Text>
                </Pressable>
              )}
              <Pressable style={[styles.botonCerrar, { flex: 1 }]} onPress={() => setVisible(false)}>
                <Text style={styles.botonCerrarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.botonAceptar, { flex: 1, backgroundColor: acento }]} onPress={aplicar}>
                <Text style={styles.botonAceptarTexto}>Aceptar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { fontSize: 12, fontWeight: "600", color: ColoresApp.textoSecundario, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: "white",
    color: ColoresApp.texto,
  },
  botonCalendario: {
    width: 42,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 10, fontStyle: "italic", color: ColoresApp.textoSecundario, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: "rgba(16,24,40,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: 300, maxWidth: "100%", backgroundColor: "white", borderRadius: 16, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTexto: { fontSize: 15, fontWeight: "700", color: ColoresApp.oscuro },
  filaSemana: { flexDirection: "row", marginBottom: 4 },
  diaSemana: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600", color: ColoresApp.textoSecundario },
  fila: { flexDirection: "row" },
  celda: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  celdaTocable: { borderRadius: 999 },
  celdaTexto: { fontSize: 13, color: ColoresApp.texto },
  horaFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ColoresApp.borde,
  },
  horaLabel: { fontSize: 12, fontWeight: "600", color: ColoresApp.textoSecundario },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBoton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ColoresApp.fondo,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValor: { fontSize: 14, fontWeight: "700", color: ColoresApp.oscuro, minWidth: 44, textAlign: "center" },
  botonCerrar: { alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: ColoresApp.fondo },
  botonCerrarTexto: { color: ColoresApp.textoSecundario, fontWeight: "600", fontSize: 13 },
  botonAceptar: { alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  botonAceptarTexto: { color: "white", fontWeight: "700", fontSize: 13 },
});
