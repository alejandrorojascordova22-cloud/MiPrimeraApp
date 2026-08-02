import { CampoTexto } from "@/components/CampoTexto";
import { ColorPickerCampo } from "@/components/ColorPickerCampo";
import { avisar, useConfirm } from "@/components/ConfirmDialog";
import { DeslizadorSimple } from "@/components/DeslizadorSimple";
import { VistaPreviaTema } from "@/components/VistaPreviaTema";
import { ColoresApp } from "@/constants/coloresApp";
import { useTemaControlador } from "@/hooks/useTemaControlador";
import { temaConfigPorDefecto, type TemaConfig } from "@/services/temaConfig";
import {
  eliminarImagenFondoTema,
  guardarTema,
  listarImagenesFondoRecientes,
  obtenerTema,
  subirImagenFondoTema,
} from "@/services/temaConfigServicio";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// ════════════════════════════════════════════════════════════════════
// CONSTANTES DE APARIENCIA
// ════════════════════════════════════════════════════════════════════
const PALETAS_PREDEFINIDAS: { nombre: string; p: string; s: string }[] = [
  { nombre: "Azul UT (actual)", p: "#0055A4", s: "#6DFE9C" },
  { nombre: "Índigo nocturno", p: "#4F46E5", s: "#818CF8" },
  { nombre: "Esmeralda", p: "#047857", s: "#34D399" },
  { nombre: "Atardecer", p: "#EA580C", s: "#FBBF24" },
  { nombre: "Fucsia", p: "#BE185D", s: "#F472B6" },
  { nombre: "Grafito", p: "#334155", s: ColoresApp.textoSecundario },
];

// Combos completos (color + fondo + estilo de tarjeta) para armar toda la
// apariencia de un toque, sin tener que ir campo por campo.
const TEMAS_RAPIDOS: {
  nombre: string;
  cambios: Partial<TemaConfig>;
}[] = [
  {
    nombre: "Azul UT clásico",
    cambios: {
      modo: "claro",
      colorPrimario: "#0055A4",
      colorSecundario: "#6DFE9C",
      fondoTipo: "color",
      fondoColor: "#F2F5FA",
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Morado nocturno",
    cambios: {
      modo: "oscuro",
      colorPrimario: "#8B5CF6",
      colorSecundario: "#A78BFA",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#0B0821",
      fondoGradienteFin: "#1E1750",
      fondoGradienteAnimado: false,
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Esmeralda glass",
    cambios: {
      modo: "claro",
      colorPrimario: "#047857",
      colorSecundario: "#34D399",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#ECFDF5",
      fondoGradienteFin: "#A7F3D0",
      fondoGradienteAnimado: false,
      estiloTarjeta: "glass",
    },
  },
  {
    nombre: "Atardecer cálido",
    cambios: {
      modo: "claro",
      colorPrimario: "#EA580C",
      colorSecundario: "#FBBF24",
      fondoTipo: "gradiente",
      fondoGradienteInicio: "#FFF7ED",
      fondoGradienteFin: "#FED7AA",
      fondoGradienteAnimado: false,
      estiloTarjeta: "sombra",
    },
  },
  {
    nombre: "Grafito minimal",
    cambios: {
      modo: "claro",
      colorPrimario: "#334155",
      colorSecundario: "#94A3B8",
      fondoTipo: "color",
      fondoColor: "#F1F5F9",
      estiloTarjeta: "plano",
    },
  },
];

const ROLES_TEMA: { valor: TemaConfig["rol"]; etiqueta: string }[] = [
  { valor: "admin", etiqueta: "Admin" },
  { valor: "aspirante", etiqueta: "Aspirante" },
];

/** Fila de opciones tipo "segmented control". */
const SegmentedRow = ({
  opciones,
  valor,
  onCambiar,
}: {
  opciones: { value: string; label: string }[];
  valor: string;
  onCambiar: (v: string) => void;
}) => (
  <View style={styles.segmentedRow}>
    {opciones.map((op) => {
      const activo = op.value === valor;
      return (
        <Pressable
          key={op.value}
          onPress={() => onCambiar(op.value)}
          style={[styles.segmentedItem, activo && styles.segmentedItemActivo]}
        >
          <Text
            style={[
              styles.segmentedItemTexto,
              activo && styles.segmentedItemTextoActivo,
            ]}
          >
            {op.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

// ════════════════════════════════════════════════════════════════════
// PANTALLA: APARIENCIA DEL SISTEMA
// (Antes era un modal dentro de Ajustes del Sistema. Se convirtió en su
// propia pantalla porque, con la cantidad de opciones que ya tiene
// —temas rápidos, paleta, fondo, imágenes recientes, etc.— un modal
// resultaba muy apretado. Ahora se navega aquí desde
// "Ajustes del Sistema > Apariencia del Sistema".)
// ════════════════════════════════════════════════════════════════════
export default function PantallaAparienciaSistema() {
  const router = useRouter();
  const [rolActivo, setRolActivo] = useState<TemaConfig["rol"]>("admin");
  const {
    tema,
    guardar,
    cargando: cargandoTema,
  } = useTemaControlador(rolActivo);
  const [borrador, setBorrador] = useState<TemaConfig>(tema);
  const [guardando, setGuardando] = useState(false);
  // A quién se le aplica lo que se está editando al presionar "Guardar":
  // solo al rol de la pestaña activa, solo al otro rol, o a ambos a la vez.
  const [destinoGuardado, setDestinoGuardado] = useState<
    "activo" | "otro" | "ambos"
  >("activo");

  useEffect(() => {
    Promise.resolve().then(() => setBorrador(tema));
  }, [tema]);

  // BUG RESUELTO: "otro"/"ambos" son conceptos RELATIVOS a la pestaña
  // activa (Admin/Aspirante). Si el admin elegía "Solo Aspirante" estando
  // en la pestaña Admin y luego cambiaba a la pestaña Aspirante SIN volver
  // a tocar este selector, la opción seguía marcada pero su significado
  // se invertía en silencio (ahora decía "Solo Admin", apuntando al rol
  // contrario del que el admin realmente quería). Eso es justo la
  // confusión de "no sé cuál se va a aplicar". Para evitarlo, cada vez
  // que se cambia de pestaña se vuelve a la opción más predecible:
  // aplicar solo al rol que se está viendo en pantalla en ese momento.
  // (Se resetea directamente en el handler que cambia `rolActivo`, más
  // abajo en el JSX — no en un efecto — para no encadenar un setState
  // extra en cada render de esta pantalla.)

  // IMPORTANTE: al cambiar de pestaña (Admin/Aspirante) el tema del rol
  // nuevo se carga de Supabase de forma asíncrona; si el admin edita un
  // color justo después de cambiar de pestaña pero antes de que esa carga
  // termine, `borrador` podía quedar con datos de la pestaña anterior
  // (incluido el campo `rol`), guardando por error en la fila equivocada
  // o mezclando valores entre roles. Forzamos aquí `rol: rolActivo` en
  // cada cambio para que, pase lo que pase con el timing de la carga, el
  // guardado siempre vaya a la fila del rol que se está viendo en pantalla.
  const cambiar = (cambios: Partial<TemaConfig>) =>
    setBorrador((b) => ({ ...b, ...cambios, rol: rolActivo }));

  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenesRecientes, setImagenesRecientes] = useState<string[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);
  const [eliminandoUrl, setEliminandoUrl] = useState<string | null>(null);

  const recargarRecientes = React.useCallback(async () => {
    setCargandoRecientes(true);
    const urls = await listarImagenesFondoRecientes(rolActivo);
    setImagenesRecientes(urls);
    setCargandoRecientes(false);
  }, [rolActivo]);

  useEffect(() => {
    if (borrador.fondoTipo !== "imagen") return;
    let activo = true;
    (async () => {
      setCargandoRecientes(true);
      const urls = await listarImagenesFondoRecientes(rolActivo);
      if (activo) {
        setImagenesRecientes(urls);
        setCargandoRecientes(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [borrador.fondoTipo, rolActivo]);

  // Al copiar la apariencia de un rol al otro (destino "otro" o "ambos"),
  // NO copiamos tal cual el color de texto: el panel de Admin y el portal
  // de Aspirante usan tarjetas de fondo distinto (p. ej. el portal de
  // Aspirante siempre usa tarjetas blancas), así que un color de texto
  // pensado para un rol puede quedar invisible en el otro (texto blanco
  // sobre tarjeta blanca). En vez de eso, mantenemos el color de texto que
  // ya tenía guardado ese otro rol (o su valor por defecto, si nunca se
  // configuró), y solo copiamos colores de marca, fondo e imagen.
  const construirParaOtroRol = async (
    base: TemaConfig,
    otroRol: TemaConfig["rol"],
  ): Promise<TemaConfig> => {
    const temaOtro = await obtenerTema(otroRol);
    return { ...base, rol: otroRol, colorTexto: temaOtro.colorTexto };
  };

  const guardarCambios = async () => {
    // Si el tema del rol seleccionado todavía se está cargando de Supabase
    // (por ejemplo, si guardas justo después de cambiar de pestaña), no
    // dejamos guardar: `borrador` podría no corresponder todavía al rol
    // activo y guardaríamos datos equivocados o incompletos.
    if (cargandoTema) {
      avisar(
        "Espera un momento",
        "El tema de esta pestaña todavía se está cargando. Intenta de nuevo en un segundo.",
      );
      return;
    }
    // Si eligieron "Imagen" como tipo de fondo pero todavía no hay una URL
    // (por ejemplo, la subida falló o se canceló), no dejamos guardar así:
    // se vería como un fondo en blanco/color de respaldo sin avisar por qué.
    if (
      borrador.fondoTipo === "imagen" &&
      (!borrador.fondoImagenUrl || borrador.fondoImagenUrl.trim() === "")
    ) {
      avisar(
        "Falta la imagen",
        "Elegiste 'Imagen' como tipo de fondo pero todavía no hay ninguna imagen subida ni una URL válida. Sube una imagen, pega una URL, o cambia el tipo de fondo a Color/Degradado/Transparente antes de guardar.",
      );
      return;
    }
    setGuardando(true);
    let exito = true;
    let error: string | undefined;
    const otroRol = rolActivo === "admin" ? "aspirante" : "admin";
    try {
      if (destinoGuardado === "activo" || destinoGuardado === "ambos") {
        const res = await guardar({ ...borrador, rol: rolActivo });
        if (!res.exito) {
          exito = false;
          error = res.error;
        }
      }
      if (
        exito &&
        (destinoGuardado === "otro" || destinoGuardado === "ambos")
      ) {
        const paraOtro = await construirParaOtroRol(borrador, otroRol);
        const resOtro = await guardarTema(paraOtro);
        if (!resOtro.exito) {
          exito = false;
          error = resOtro.error;
        }
      }
    } catch (e) {
      console.error("Excepción al guardar apariencia:", e);
      exito = false;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      setGuardando(false);
    }
    avisar(
      exito ? "Listo" : "Error",
      exito
        ? destinoGuardado === "ambos"
          ? "Apariencia guardada y aplicada a Admin y Aspirante."
          : destinoGuardado === "otro"
            ? `Apariencia guardada y aplicada a "${otroRol === "admin" ? "Admin" : "Aspirante"}".`
            : `Apariencia guardada y aplicada a "${rolActivo === "admin" ? "Admin" : "Aspirante"}".`
        : `No se pudo guardar. ${error ?? "Revisa que exista la tabla configuracion_tema en Supabase."}`,
    );
    if (exito) router.replace("/panel");
  };

  const confirmarRestaurar = useConfirm();

  const restaurarPorDefecto = () => {
    const otroRol = rolActivo === "admin" ? "aspirante" : "admin";
    confirmarRestaurar({
      titulo: "Restaurar por defecto",
      mensaje:
        destinoGuardado === "ambos"
          ? "Esto va a reemplazar la apariencia guardada de Admin y Aspirante por el tema original. ¿Continuar?"
          : destinoGuardado === "otro"
            ? `Esto va a reemplazar la apariencia guardada de "${otroRol === "admin" ? "Admin" : "Aspirante"}" por el tema original. ¿Continuar?`
            : `Esto va a reemplazar la apariencia guardada de "${rolActivo === "admin" ? "Admin" : "Aspirante"}" por el tema original. ¿Continuar?`,
      textoConfirmar: "Sí, restaurar",
      destructivo: true,
      onConfirmar: async () => {
        const porDefecto = temaConfigPorDefecto(rolActivo);
        setBorrador(porDefecto);
        setGuardando(true);
        let exito = true;
        let error: string | undefined;
        try {
          if (destinoGuardado === "activo" || destinoGuardado === "ambos") {
            const res = await guardar(porDefecto);
            if (!res.exito) {
              exito = false;
              error = res.error;
            }
          }
          if (
            exito &&
            (destinoGuardado === "otro" || destinoGuardado === "ambos")
          ) {
            const resOtro = await guardarTema(temaConfigPorDefecto(otroRol));
            if (!resOtro.exito) {
              exito = false;
              error = resOtro.error;
            }
          }
        } catch (e) {
          exito = false;
          error = e instanceof Error ? e.message : String(e);
        } finally {
          setGuardando(false);
        }
        avisar(
          exito ? "Listo" : "Error",
          exito
            ? "Se restauró la apariencia por defecto."
            : `No se pudo restaurar. ${error ?? "Intenta de nuevo."}`,
        );
        if (exito) router.replace("/panel");
      },
    });
  };

  const elegirImagenFondo = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const archivo = resultado.assets[0];

      setSubiendoImagen(true);
      const respuesta = await fetch(archivo.uri);
      const bytes = await respuesta.blob();
      const url = await subirImagenFondoTema(
        rolActivo,
        bytes,
        archivo.name,
        archivo.mimeType,
      );
      if (url) {
        cambiar({ fondoImagenUrl: url });
        setImagenesRecientes((prev) => [url, ...prev]);
      } else {
        avisar("Error", "No se pudo subir la imagen. Intenta de nuevo.");
      }
    } catch (e) {
      console.error("Excepción al elegir/subir imagen de fondo:", e);
      avisar("Error", "Ocurrió un problema al seleccionar la imagen.");
    } finally {
      setSubiendoImagen(false);
    }
  };

  const confirmarEliminarImagen = useConfirm();

  const eliminarImagenReciente = (url: string) => {
    confirmarEliminarImagen({
      titulo: "Eliminar imagen",
      mensaje:
        "Esta imagen se va a borrar de las recientes. Si está en uso como fondo, seguirá viéndose hasta que elijas otra.",
      textoConfirmar: "Sí, eliminar",
      destructivo: true,
      onConfirmar: async () => {
        setEliminandoUrl(url);
        const exito = await eliminarImagenFondoTema(url);
        if (exito) {
          setImagenesRecientes((prev) => prev.filter((u) => u !== url));
        } else {
          avisar("Error", "No se pudo eliminar la imagen. Intenta de nuevo.");
        }
        setEliminandoUrl(null);
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Apariencia del Sistema" }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={ColoresApp.texto} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.mainTitle}>Apariencia del Sistema</Text>
              <Text style={styles.mainSubtitle}>
                Personaliza colores, fondo y estilo de tarjetas de la app.
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {ROLES_TEMA.map((r) => {
              const activo = rolActivo === r.valor;
              return (
                <Pressable
                  key={r.valor}
                  onPress={() => {
                    setRolActivo(r.valor);
                    setDestinoGuardado("activo");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 20,
                    alignItems: "center",
                    backgroundColor: activo
                      ? ColoresApp.primario
                      : ColoresApp.borde,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      fontSize: 13,
                      color: activo ? "white" : ColoresApp.textoSecundario,
                    }}
                  >
                    {r.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.destinoBox}>
            <Text style={styles.segmentedLabel}>
              AL GUARDAR, APLICAR ESTA APARIENCIA A
            </Text>
            <SegmentedRow
              opciones={[
                {
                  value: "activo",
                  label:
                    rolActivo === "admin" ? "Solo Admin" : "Solo Aspirante",
                },
                {
                  value: "otro",
                  label:
                    rolActivo === "admin" ? "Solo Aspirante" : "Solo Admin",
                },
                { value: "ambos", label: "Ambos" },
              ]}
              valor={destinoGuardado}
              onCambiar={(v) => setDestinoGuardado(v as typeof destinoGuardado)}
            />
            <Text style={styles.destinoAyuda}>
              {destinoGuardado === "ambos"
                ? "Se guardará la misma apariencia para Admin y Aspirante."
                : destinoGuardado === "otro"
                  ? `Se guardará solo para "${rolActivo === "admin" ? "Aspirante" : "Admin"}" (no se toca "${rolActivo === "admin" ? "Admin" : "Aspirante"}").`
                  : `Se guardará solo para "${rolActivo === "admin" ? "Admin" : "Aspirante"}" (no se toca el otro rol).`}
            </Text>
          </View>

          <Text style={styles.segmentedLabel}>TEMAS RÁPIDOS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 4 }}
          >
            {TEMAS_RAPIDOS.map((rapido) => (
              <Pressable
                key={rapido.nombre}
                onPress={() => cambiar(rapido.cambios)}
                style={{
                  marginRight: 10,
                  borderRadius: 14,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: ColoresApp.borde,
                  width: 92,
                }}
              >
                <View
                  style={{
                    height: 46,
                    backgroundColor:
                      rapido.cambios.fondoTipo === "gradiente"
                        ? rapido.cambios.fondoGradienteFin
                        : rapido.cambios.fondoColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      backgroundColor: rapido.cambios.colorPrimario,
                    }}
                  />
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 10.5,
                    fontWeight: "600",
                    textAlign: "center",
                    color: ColoresApp.texto,
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                  }}
                >
                  {rapido.nombre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <VistaPreviaTema tema={borrador} />

          <Text style={styles.segmentedLabel}>MODO</Text>
          <SegmentedRow
            opciones={[
              { value: "claro", label: "Claro" },
              { value: "oscuro", label: "Oscuro" },
              { value: "auto", label: "Auto" },
            ]}
            valor={borrador.modo}
            onCambiar={(v) => cambiar({ modo: v as TemaConfig["modo"] })}
          />

          <Text style={styles.segmentedLabel}>COLOR DEL SISTEMA</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {PALETAS_PREDEFINIDAS.map((paleta) => {
              const seleccionada =
                borrador.colorPrimario.toUpperCase() === paleta.p.toUpperCase();
              return (
                <Pressable
                  key={paleta.nombre}
                  onPress={() =>
                    cambiar({
                      colorPrimario: paleta.p,
                      colorSecundario: paleta.s,
                    })
                  }
                  style={[
                    styles.paletaCirculo,
                    {
                      backgroundColor: paleta.p,
                      borderColor: seleccionada ? paleta.p : "transparent",
                    },
                  ]}
                >
                  {seleccionada && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </Pressable>
              );
            })}
          </View>
          <ColorPickerCampo
            etiqueta="Color primario"
            ayuda="Botones y detalles principales"
            valor={borrador.colorPrimario}
            onChangeText={(v) => cambiar({ colorPrimario: v })}
          />
          <ColorPickerCampo
            etiqueta="Color secundario / acento"
            ayuda="Detalles, bordes y puntos de énfasis"
            valor={borrador.colorSecundario}
            onChangeText={(v) => cambiar({ colorSecundario: v })}
          />
          <ColorPickerCampo
            etiqueta="Color de texto"
            ayuda="Texto sobre el fondo configurado abajo"
            valor={borrador.colorTexto}
            onChangeText={(v) => cambiar({ colorTexto: v })}
          />

          <Text style={styles.segmentedLabel}>FONDO</Text>
          <SegmentedRow
            opciones={[
              { value: "color", label: "Color" },
              { value: "gradiente", label: "Degradado" },
              { value: "imagen", label: "Imagen" },
              { value: "transparente", label: "Transparente" },
            ]}
            valor={borrador.fondoTipo}
            onCambiar={(v) =>
              cambiar({ fondoTipo: v as TemaConfig["fondoTipo"] })
            }
          />
          {borrador.fondoTipo === "transparente" && (
            <Text style={styles.modalSubtitle}>
              Sin color de fondo: se ve el fondo nativo del dispositivo/
              navegador detrás de cada pantalla.
            </Text>
          )}
          {borrador.fondoTipo === "color" && (
            <ColorPickerCampo
              etiqueta="Color de fondo"
              valor={borrador.fondoColor}
              onChangeText={(v) => cambiar({ fondoColor: v })}
            />
          )}
          {borrador.fondoTipo === "gradiente" && (
            <>
              <ColorPickerCampo
                etiqueta="Degradado — color inicial"
                valor={borrador.fondoGradienteInicio}
                onChangeText={(v) => cambiar({ fondoGradienteInicio: v })}
              />
              <ColorPickerCampo
                etiqueta="Degradado — color final"
                valor={borrador.fondoGradienteFin}
                onChangeText={(v) => cambiar({ fondoGradienteFin: v })}
              />
              <Pressable
                onPress={() =>
                  cambiar({
                    fondoGradienteAnimado: !borrador.fondoGradienteAnimado,
                  })
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: ColoresApp.texto, fontWeight: "600" }}>
                  Animar degradado
                </Text>
                <View
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    padding: 2,
                    backgroundColor: borrador.fondoGradienteAnimado
                      ? ColoresApp.primario
                      : ColoresApp.borde,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "white",
                      alignSelf: borrador.fondoGradienteAnimado
                        ? "flex-end"
                        : "flex-start",
                    }}
                  />
                </View>
              </Pressable>
              {borrador.fondoGradienteAnimado && (
                <CampoTexto
                  etiqueta="Velocidad de la animación (ms, ej. 6000)"
                  valor={String(borrador.fondoGradienteDuracionMs)}
                  onChangeText={(v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n))
                      cambiar({
                        fondoGradienteDuracionMs: Math.max(1000, n),
                      });
                  }}
                  keyboardType="number-pad"
                  icono="speedometer-outline"
                />
              )}
            </>
          )}
          {borrador.fondoTipo === "imagen" && (
            <>
              <Text style={styles.segmentedLabel}>IMAGEN DE FONDO</Text>
              <Pressable
                style={styles.selectorImagenBoton}
                onPress={elegirImagenFondo}
                disabled={subiendoImagen}
              >
                {subiendoImagen ? (
                  <ActivityIndicator size="small" color={ColoresApp.primario} />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={ColoresApp.primario}
                  />
                )}
                <Text style={styles.selectorImagenTexto} numberOfLines={1}>
                  {subiendoImagen
                    ? "Subiendo imagen..."
                    : "Elegir imagen desde mi celular o computadora"}
                </Text>
              </Pressable>
              <CampoTexto
                etiqueta="O pega la URL de una imagen (opcional)"
                valor={borrador.fondoImagenUrl ?? ""}
                onChangeText={(v) => cambiar({ fondoImagenUrl: v })}
                icono="link-outline"
                autoCapitalize="none"
              />
              {(cargandoRecientes || imagenesRecientes.length > 0) && (
                <>
                  <View style={styles.recientesHeaderRow}>
                    <Text style={[styles.segmentedLabel, { marginBottom: 0 }]}>
                      RECIENTES (TOCA PARA REUSAR)
                    </Text>
                    {!cargandoRecientes && imagenesRecientes.length > 0 && (
                      <Pressable onPress={recargarRecientes} hitSlop={8}>
                        <Ionicons
                          name="refresh"
                          size={16}
                          color={ColoresApp.textoSecundario}
                        />
                      </Pressable>
                    )}
                  </View>
                  {cargandoRecientes ? (
                    <ActivityIndicator
                      size="small"
                      color={ColoresApp.primario}
                    />
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 8 }}
                    >
                      {imagenesRecientes.map((url) => {
                        const activa = borrador.fondoImagenUrl === url;
                        const eliminando = eliminandoUrl === url;
                        return (
                          <View key={url} style={styles.recienteItemWrap}>
                            <Pressable
                              onPress={() => cambiar({ fondoImagenUrl: url })}
                              style={{
                                borderRadius: 10,
                                overflow: "hidden",
                                borderWidth: activa ? 3 : 1,
                                borderColor: activa
                                  ? ColoresApp.primario
                                  : ColoresApp.borde,
                              }}
                            >
                              <Image
                                source={{ uri: url }}
                                style={{ width: 64, height: 64 }}
                                resizeMode="cover"
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => eliminarImagenReciente(url)}
                              disabled={eliminando}
                              style={styles.recienteEliminarBoton}
                              hitSlop={6}
                            >
                              {eliminando ? (
                                <ActivityIndicator size="small" color="white" />
                              ) : (
                                <Ionicons
                                  name="close"
                                  size={12}
                                  color="white"
                                />
                              )}
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </>
              )}
              <Text style={styles.segmentedLabel}>
                OSCURECER IMAGEN (
                {Math.round(borrador.fondoOpacidadOverlay * 100)}%)
              </Text>
              <DeslizadorSimple
                valor={borrador.fondoOpacidadOverlay}
                onCambiar={(v) => cambiar({ fondoOpacidadOverlay: v })}
                color={ColoresApp.primario}
                colorPista={ColoresApp.borde}
              />
            </>
          )}

          <Text style={styles.segmentedLabel}>ESTILO DE TARJETAS</Text>
          <SegmentedRow
            opciones={[
              { value: "plano", label: "Plano" },
              { value: "sombra", label: "Sombra" },
              { value: "glass", label: "Glass" },
            ]}
            valor={borrador.estiloTarjeta}
            onCambiar={(v) =>
              cambiar({ estiloTarjeta: v as TemaConfig["estiloTarjeta"] })
            }
          />
          <CampoTexto
            etiqueta="Radio de bordes (0 a 32px)"
            valor={String(borrador.radioBordes)}
            onChangeText={(v) => {
              const n = parseInt(v, 10);
              if (!isNaN(n))
                cambiar({ radioBordes: Math.min(32, Math.max(0, n)) });
            }}
            keyboardType="number-pad"
            icono="ellipse-outline"
          />

          <Text style={[styles.modalSubtitle, { marginTop: 10 }]}>
            &quot;Restaurar por defecto&quot; guarda de inmediato el tema
            original (te pedirá confirmación antes de aplicarlo).
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              style={styles.actionButton}
              onPress={restaurarPorDefecto}
              disabled={guardando || cargandoTema}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>
                  Restaurar por defecto
                </Text>
              )}
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={guardarCambios}
              disabled={guardando || cargandoTema}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Guardar</Text>
              )}
            </Pressable>
          </View>
          <Pressable
            style={{ marginTop: 4, marginBottom: 20 }}
            onPress={() => router.back()}
          >
            <Text style={{ textAlign: "center", color: "grey" }}>Cancelar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ColoresApp.fondo },
  scrollContent: { paddingVertical: 20, paddingHorizontal: 20 },
  contentWrapper: {
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ColoresApp.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: ColoresApp.oscuro,
    letterSpacing: -0.5,
  },
  mainSubtitle: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  destinoBox: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  destinoAyuda: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    marginTop: 6,
  },
  segmentedLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: ColoresApp.textoSecundario,
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: ColoresApp.borde,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentedItemActivo: { backgroundColor: ColoresApp.oscuro },
  segmentedItemTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.oscuro,
  },
  segmentedItemTextoActivo: { color: "white" },
  paletaCirculo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSubtitle: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginBottom: 4,
  },
  selectorImagenBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: ColoresApp.primario,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  selectorImagenTexto: {
    color: ColoresApp.primario,
    fontWeight: "600",
    flexShrink: 1,
  },
  recientesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
  },
  recienteItemWrap: {
    marginRight: 10,
    width: 64,
  },
  recienteEliminarBoton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#D64545",
    alignItems: "center",
    justifyContent: "center",
  },
  modalActions: { marginTop: 16, gap: 10 },
  actionButton: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: { color: "white", fontWeight: "bold" },
});
