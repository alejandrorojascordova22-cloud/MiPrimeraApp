import { ColoresApp } from "@/constants/coloresApp";
import { obtenerCarreras } from "@/services/carrerasServicio";
import {
  ETIQUETAS_POR_TIPO_MATERIAL,
  actualizarInfoMaterial,
  asignarCarrerasMaterial,
  eliminarMaterialEstudio,
  obtenerMaterialesEstudio,
  reemplazarArchivoMaterial,
  subirMaterialEstudio,
} from "@/services/materialesEstudioServicio";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useResponsivo } from "@/utils/responsive";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// --- TIPOS ---
type TipoMaterial = "pdf" | "audio" | "imagen" | "video" | "otro";

type MaterialEstudio = {
  id: number;
  titulo: string;
  descripcion?: string;
  tipo: TipoMaterial;
  nombre_archivo: string;
  url_publica: string;
  ruta_storage?: string;
  tamano_bytes: number;
  creado_en: string;
  materia?: string;
  aplica_a_todas?: boolean;
};

type Carrera = { id: number; nombre: string };

// --- CONSTANTES DE ESTILO ---
const Colors = {
  orange: "#F97316",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  red: "#EF4444",
  blueGrey: "#64748B",
};

// --- COMPONENTES REUTILIZABLES ---

const getTipoInfo = (tipo: TipoMaterial) => {
  switch (tipo) {
    case "pdf":
      return { icon: "document-text-outline" as const, color: Colors.orange };
    case "audio":
      return { icon: "musical-notes-outline" as const, color: Colors.purple };
    case "imagen":
      return { icon: "image-outline" as const, color: Colors.teal };
    case "video":
      return { icon: "videocam-outline" as const, color: Colors.red };
    default:
      return { icon: "document-outline" as const, color: Colors.blueGrey };
  }
};

function inferirTipoPorNombre(nombre: string): TipoMaterial {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["mp3", "wav", "m4a", "ogg", "aac"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "imagen";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  return "otro";
}

const formatBytes = (bytes?: number) => {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    return dt.toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const MaterialCard = ({
  material,
  onEdit,
  onDelete,
  onView,
}: {
  material: MaterialEstudio;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}) => {
  const { icon, color } = getTipoInfo(material.tipo);
  const { esMovil } = useResponsivo();

  const botones = (
    <>
      <Pressable hitSlop={8} onPress={onView}>
        <Ionicons name="eye-outline" size={20} color="gray" />
      </Pressable>
      <Pressable hitSlop={8} onPress={onEdit}>
        <Ionicons name="create-outline" size={20} color="gray" />
      </Pressable>
      <Pressable hitSlop={8} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color="red" />
      </Pressable>
    </>
  );

  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {material.titulo}
          </Text>
          {/* En escritorio el badge cabe junto al título; en móvil se va
              a su propia línea para no competir por el ancho con el título
              ni con los botones de acciones (que en desktop van flotando
              arriba a la derecha). */}
          {!esMovil && (
            <View style={[styles.typeBadge, { backgroundColor: `${color}20` }]}>
              <Text style={[styles.typeBadgeText, { color }]}>
                {ETIQUETAS_POR_TIPO_MATERIAL[material.tipo] ??
                  material.tipo.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        {esMovil && (
          <View style={[styles.typeBadge, styles.typeBadgeMovil, { backgroundColor: `${color}20` }]}>
            <Text style={[styles.typeBadgeText, { color }]}>
              {ETIQUETAS_POR_TIPO_MATERIAL[material.tipo] ??
                material.tipo.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {material.nombre_archivo}
        </Text>
        {material.materia ? (
          <Text
            style={[
              styles.cardMeta,
              { color: ColoresApp.primario, fontWeight: "600" },
            ]}
          >
            {material.materia}
          </Text>
        ) : null}
        {material.descripcion ? (
          <Text style={styles.cardDescription} numberOfLines={3}>
            {material.descripcion}
          </Text>
        ) : null}
        <Text
          style={styles.cardMeta}
        >{`${formatDate(material.creado_en)} · ${formatBytes(material.tamano_bytes)}`}</Text>
        {/* En móvil los botones van en su propia fila, debajo del contenido,
            para no taparse con el título como pasaba con position:absolute. */}
        {esMovil && (
          <View style={styles.actionsContainerMovil}>{botones}</View>
        )}
      </View>
      {!esMovil && (
        <View style={styles.actionsContainer}>{botones}</View>
      )}
    </View>
  );
};

const SelectorCarreras = ({
  carreras,
  aplicaATodas,
  onToggleTodas,
  carrerasSeleccionadas,
  onToggleCarrera,
}: {
  carreras: Carrera[];
  aplicaATodas: boolean;
  onToggleTodas: (valor: boolean) => void;
  carrerasSeleccionadas: number[];
  onToggleCarrera: (id: number) => void;
}) => (
  <View style={{ gap: 8 }}>
    <Text style={styles.fieldLabel}>¿A quién aplica este material?</Text>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Pressable
        style={[styles.scopeChip, aplicaATodas && styles.scopeChipActivo]}
        onPress={() => onToggleTodas(true)}
      >
        <Text
          style={
            aplicaATodas ? styles.scopeChipTextoActivo : styles.scopeChipTexto
          }
        >
          Todas las carreras
        </Text>
      </Pressable>
      <Pressable
        style={[styles.scopeChip, !aplicaATodas && styles.scopeChipActivo]}
        onPress={() => onToggleTodas(false)}
      >
        <Text
          style={
            !aplicaATodas ? styles.scopeChipTextoActivo : styles.scopeChipTexto
          }
        >
          Carreras específicas
        </Text>
      </Pressable>
    </View>
    {!aplicaATodas && (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {carreras.map((c) => {
          const activa = carrerasSeleccionadas.includes(c.id);
          return (
            <Pressable
              key={c.id}
              style={[styles.scopeChip, activa && styles.scopeChipActivo]}
              onPress={() => onToggleCarrera(c.id)}
            >
              <Text
                style={
                  activa ? styles.scopeChipTextoActivo : styles.scopeChipTexto
                }
              >
                {c.nombre}
              </Text>
            </Pressable>
          );
        })}
        {carreras.length === 0 && (
          <Text style={{ fontSize: 12, color: ColoresApp.textoSecundario }}>
            No hay carreras registradas.
          </Text>
        )}
      </View>
    )}
  </View>
);

// Modal para subir un material nuevo
const SubirMaterialModal = ({
  visible,
  onClose,
  onGuardado,
  carreras,
}: {
  visible: boolean;
  onClose: () => void;
  onGuardado: () => void;
  carreras: Carrera[];
}) => {
  const avisar = (titulo: string, mensaje?: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      console.error(`[${titulo}]`, mensaje ?? "");
      window.alert(mensaje ? `${titulo}: ${mensaje}` : titulo);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [materia, setMateria] = useState("");
  const [aplicaATodas, setAplicaATodas] = useState(true);
  const [carrerasSeleccionadas, setCarrerasSeleccionadas] = useState<number[]>(
    [],
  );
  const [archivo, setArchivo] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const resetAndClose = () => {
    setTitulo("");
    setDescripcion("");
    setMateria("");
    setAplicaATodas(true);
    setCarrerasSeleccionadas([]);
    setArchivo(null);
    setSubiendo(false);
    onClose();
  };

  const toggleCarrera = (id: number) => {
    setCarrerasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const elegirArchivo = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (
      !resultado.canceled &&
      resultado.assets &&
      resultado.assets.length > 0
    ) {
      setArchivo(resultado.assets[0]);
    }
  };

  const handleGuardar = async () => {
    if (!titulo.trim()) {
      avisar("Falta información", "Escribe un título para el material.");
      return;
    }
    if (!archivo) {
      avisar("Falta información", "Selecciona un archivo para subir.");
      return;
    }
    if (!aplicaATodas && carrerasSeleccionadas.length === 0) {
      avisar(
        "Falta información",
        'Elige al menos una carrera, o marca "Todas las carreras".',
      );
      return;
    }
    setSubiendo(true);
    try {
      const respuesta = await fetch(archivo.uri);
      const bytes = await respuesta.blob();
      const tipo = inferirTipoPorNombre(archivo.name);
      const res = await subirMaterialEstudio({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        nombreArchivoOriginal: archivo.name,
        bytes,
        mimeType: archivo.mimeType,
        materia: materia.trim() || undefined,
        aplicaATodas,
        carrerasIds: carrerasSeleccionadas,
      });
      if (res) {
        onGuardado();
        resetAndClose();
      } else {
        console.error("subirMaterialEstudio devolvió null");
        avisar("Error", "No se pudo subir el material.");
      }
    } catch (e) {
      console.error("Excepción al subir material:", e);
      avisar("Error", "Ocurrió un problema al subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={resetAndClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Agregar material de estudio</Text>
          <TextInput
            style={styles.input}
            placeholder="Título"
            value={titulo}
            onChangeText={setTitulo}
          />
          <TextInput
            style={styles.input}
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />
          <TextInput
            style={styles.input}
            placeholder="Materia/tema (ej. Matemáticas) — opcional"
            value={materia}
            onChangeText={setMateria}
          />
          <SelectorCarreras
            carreras={carreras}
            aplicaATodas={aplicaATodas}
            onToggleTodas={setAplicaATodas}
            carrerasSeleccionadas={carrerasSeleccionadas}
            onToggleCarrera={toggleCarrera}
          />
          <Pressable style={styles.filePickerButton} onPress={elegirArchivo}>
            <Ionicons
              name="attach-outline"
              size={18}
              color={ColoresApp.primario}
            />
            <Text
              style={{ color: ColoresApp.primario, fontWeight: "600" }}
              numberOfLines={1}
            >
              {archivo ? archivo.name : "Seleccionar archivo"}
            </Text>
          </Pressable>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={resetAndClose}
            >
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={handleGuardar}
              disabled={subiendo}
            >
              {subiendo ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Subir
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Modal para editar título/descripción o reemplazar el archivo
const EditarMaterialModal = ({
  visible,
  onClose,
  material,
  onGuardado,
  carreras,
}: {
  visible: boolean;
  onClose: () => void;
  material: MaterialEstudio | null;
  onGuardado: () => void;
  carreras: Carrera[];
}) => {
  const avisar = (titulo: string, mensaje?: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      console.error(`[${titulo}]`, mensaje ?? "");
      window.alert(mensaje ? `${titulo}: ${mensaje}` : titulo);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  // El padre remonta este componente con una `key` distinta cada vez que se
  // abre un material a editar (ver `key={editor-${editorKey}}` en el padre),
  // así que es seguro inicializar el estado directamente desde `material`
  // aquí, sin necesidad de un useEffect que lo sincronice después del montaje.
  const [titulo, setTitulo] = useState(material?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(material?.descripcion ?? "");
  const [materia, setMateria] = useState(material?.materia ?? "");
  const [aplicaATodas, setAplicaATodas] = useState(
    material?.aplica_a_todas ?? true,
  );
  const [carrerasSeleccionadas, setCarrerasSeleccionadas] = useState<number[]>(
    [],
  );
  const [nuevoArchivo, setNuevoArchivo] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [guardando, setGuardando] = useState(false);

  const resetAndClose = () => {
    setNuevoArchivo(null);
    setGuardando(false);
    onClose();
  };

  const toggleCarrera = (id: number) => {
    setCarrerasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const elegirArchivo = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (
      !resultado.canceled &&
      resultado.assets &&
      resultado.assets.length > 0
    ) {
      setNuevoArchivo(resultado.assets[0]);
    }
  };

  const handleGuardar = async () => {
    if (!material) return;
    if (!titulo.trim()) {
      avisar("Falta información", "El título no puede quedar vacío.");
      return;
    }
    if (!aplicaATodas && carrerasSeleccionadas.length === 0) {
      avisar(
        "Falta información",
        'Elige al menos una carrera, o marca "Todas las carreras".',
      );
      return;
    }
    setGuardando(true);
    try {
      const okInfo = await actualizarInfoMaterial({
        id: material.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
      });

      const okAlcance = await asignarCarrerasMaterial(material.id, {
        aplicaATodas,
        carrerasIds: carrerasSeleccionadas,
      });

      let okArchivo = true;
      if (nuevoArchivo) {
        const respuesta = await fetch(nuevoArchivo.uri);
        const bytes = await respuesta.blob();
        okArchivo = await reemplazarArchivoMaterial({
          materialActual: material,
          nombreArchivoOriginal: nuevoArchivo.name,
          bytes,
          mimeType: nuevoArchivo.mimeType,
        });
      }

      if (okInfo && okAlcance && okArchivo) {
        onGuardado();
        resetAndClose();
      } else {
        console.error(
          "reemplazarArchivoMaterial/actualizarInfoMaterial/asignarCarrerasMaterial devolvió false",
        );
        avisar("Error", "No se pudieron guardar todos los cambios.");
      }
    } catch (e) {
      console.error("Excepción al editar material:", e);
      avisar("Error", "Ocurrió un problema al guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={resetAndClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Editar material</Text>
          <TextInput
            style={styles.input}
            placeholder="Título"
            value={titulo}
            onChangeText={setTitulo}
          />
          <TextInput
            style={styles.input}
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />
          <TextInput
            style={styles.input}
            placeholder="Materia/tema (ej. Matemáticas) — opcional"
            value={materia}
            onChangeText={setMateria}
          />
          <SelectorCarreras
            carreras={carreras}
            aplicaATodas={aplicaATodas}
            onToggleTodas={setAplicaATodas}
            carrerasSeleccionadas={carrerasSeleccionadas}
            onToggleCarrera={toggleCarrera}
          />
          <Pressable style={styles.filePickerButton} onPress={elegirArchivo}>
            <Ionicons
              name="swap-horizontal-outline"
              size={18}
              color={ColoresApp.primario}
            />
            <Text
              style={{ color: ColoresApp.primario, fontWeight: "600" }}
              numberOfLines={1}
            >
              {nuevoArchivo
                ? nuevoArchivo.name
                : "Reemplazar archivo (opcional)"}
            </Text>
          </Pressable>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={resetAndClose}
            >
              <Text>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSubmit]}
              onPress={handleGuardar}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Guardar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// --- PANTALLA PRINCIPAL ---

export default function GestionarMaterialesScreen() {
  const { esMovil } = useResponsivo();
  const [materiales, setMateriales] = useState<MaterialEstudio[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalSubirVisible, setModalSubirVisible] = useState(false);
  const [materialEditando, setMaterialEditando] =
    useState<MaterialEstudio | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const avisar = (titulo: string, mensaje?: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      console.error(`[${titulo}]`, mensaje ?? "");
      window.alert(mensaje ? `${titulo}: ${mensaje}` : titulo);
    } else {
      Alert.alert(titulo, mensaje);
    }
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, listaCarreras] = await Promise.all([
        obtenerMaterialesEstudio(),
        obtenerCarreras(),
      ]);
      setMateriales(lista as MaterialEstudio[]);
      setCarreras(listaCarreras as Carrera[]);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de datos desde el servidor al montar la pantalla; no es
    // estado derivado de props, es una sincronización legítima con Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]); // `cargar` está envuelto en useCallback, por lo que este efecto solo se ejecuta una vez.

  const handleEliminar = (material: MaterialEstudio) => {
    const ejecutarEliminar = async () => {
      const exito = await eliminarMaterialEstudio(material);
      if (exito) {
        cargar();
      } else {
        console.error("eliminarMaterialEstudio falló para id:", material.id);
        avisar("Error", "No se pudo eliminar el documento.");
      }
    };

    // Alert.alert con botones no muestra ningún diálogo en web (queda en
    // silencio), así que ahí usamos window.confirm en su lugar.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (
        window.confirm(
          `¿Eliminar "${material.titulo}"? Se eliminará de forma permanente.`,
        )
      ) {
        ejecutarEliminar();
      }
      return;
    }

    Alert.alert(
      "¿Eliminar documento?",
      `Se eliminará "${material.titulo}" de forma permanente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: ejecutarEliminar,
        },
      ],
    );
  };

  const handleVer = (material: MaterialEstudio) => {
    Linking.openURL(material.url_publica).catch(() => {
      avisar("Error", "No se pudo abrir el archivo.");
    });
  };

  const renderContent = () => {
    if (cargando && materiales.length === 0) {
      return <ActivityIndicator style={{ marginTop: 50 }} size="large" />;
    }
    if (error) {
      return <Text style={styles.emptyText}>Error: {error}</Text>;
    }
    if (materiales.length === 0) {
      return (
        <Text style={styles.emptyText}>Aún no hay documentos subidos.</Text>
      );
    }
    return (
      <FlatList
        data={materiales}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <MaterialCard
            material={item}
            onView={() => handleVer(item)}
            onEdit={() => {
              setEditorKey((k) => k + 1);
              setMaterialEditando(item);
            }}
            onDelete={() => handleEliminar(item)}
          />
        )}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={cargando} onRefresh={cargar} />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Text style={styles.topBarTitulo}>Materiales de estudio</Text>
      </View>
      {renderContent()}
      <Pressable
        style={[styles.fab, esMovil && styles.fabMovil]}
        onPress={() => setModalSubirVisible(true)}
      >
        <Ionicons name="add" size={24} color="white" />
        {!esMovil && <Text style={styles.fabText}>Agregar documento</Text>}
      </Pressable>

      <SubirMaterialModal
        visible={modalSubirVisible}
        onClose={() => setModalSubirVisible(false)}
        onGuardado={cargar}
        carreras={carreras}
      />
      <EditarMaterialModal
        key={`editor-${editorKey}`}
        visible={materialEditando != null}
        material={materialEditando}
        onClose={() => {
          setMaterialEditando(null);
        }}
        onGuardado={cargar}
        carreras={carreras}
      />
    </SafeAreaView>
  );
}

// --- ESTILOS ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ColoresApp.fondo,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  topBarTitulo: { fontSize: 15, fontWeight: "600", color: ColoresApp.oscuro },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Espacio para el FAB
  },
  emptyText: {
    marginTop: 100,
    textAlign: "center",
    color: ColoresApp.textoSecundario,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconContainer: {
    padding: 10,
    borderRadius: 10,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ColoresApp.oscuro,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  typeBadgeMovil: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 12,
    color: ColoresApp.texto,
    marginTop: 6,
  },
  cardMeta: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    marginTop: 6,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "white",
    padding: 4,
  },
  actionsContainerMovil: {
    flexDirection: "row",
    gap: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: ColoresApp.borde,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: ColoresApp.primario,
    borderRadius: 99,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 6px #0000004D",
  },
  fabText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  fabMovil: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    bottom: 20,
    right: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 420,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: ColoresApp.oscuro,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 9,
    padding: 12,
    fontSize: 14,
    color: ColoresApp.texto,
  },
  filePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: ColoresApp.primario,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 10,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: ColoresApp.fondo,
  },
  modalButtonSubmit: {
    backgroundColor: ColoresApp.primario,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ColoresApp.textoSecundario,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    backgroundColor: "white",
  },
  scopeChipActivo: {
    backgroundColor: ColoresApp.primarioFondo,
    borderColor: ColoresApp.primario,
  },
  scopeChipTexto: {
    fontSize: 12,
    color: ColoresApp.textoSecundario,
  },
  scopeChipTextoActivo: {
    fontSize: 12,
    color: ColoresApp.primario,
    fontWeight: "600",
  },
});