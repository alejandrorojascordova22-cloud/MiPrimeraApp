import { ColoresApp } from '@/constants/coloresApp';
import {
  contarAvisosNoLeidos,
  marcarAvisoLeido,
  obtenerAvisosParaAspirante,
  type Aviso,
} from '@/services/avisosServicio';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try {
    const dt = new Date(iso);
    return dt.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const AvisoCard = ({ aviso, onAbrir }: { aviso: Aviso; onAbrir: () => void }) => (
  <Pressable style={[styles.card, !aviso.leido && styles.cardNoLeida]} onPress={onAbrir}>
    <View style={styles.cardHeader}>
      {!aviso.leido && <View style={styles.puntoNoLeido} />}
      <Text style={styles.cardTitulo} numberOfLines={2}>{aviso.titulo}</Text>
    </View>
    <Text style={styles.cardContenido} numberOfLines={3}>{aviso.contenido}</Text>
    <Text style={styles.cardFecha}>{formatDate(aviso.creado_en)}</Text>
  </Pressable>
);

/**
 * Pantalla de avisos para el aspirante. Se espera navegar con parámetros
 * `?aspiranteId=..&carreraId=..` (los mismos que ya maneja
 * perfil-aspirante.tsx en su sesión).
 */
export default function AvisosAspiranteScreen() {
  const router = useRouter();
  const { aspiranteId, carreraId } = useLocalSearchParams<{
    aspiranteId?: string;
    carreraId?: string;
  }>();

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [avisoAbierto, setAvisoAbierto] = useState<Aviso | null>(null);

  const idAspirante = Number(aspiranteId ?? 0);
  const idCarrera = Number(carreraId ?? 0);

  const cargar = useCallback(async () => {
    if (!idAspirante || !idCarrera) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const lista = await obtenerAvisosParaAspirante(idAspirante, idCarrera);
      setAvisos(lista);
    } finally {
      setCargando(false);
    }
  }, [idAspirante, idCarrera]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirAviso = async (aviso: Aviso) => {
    setAvisoAbierto(aviso);
    if (!aviso.leido) {
      await marcarAvisoLeido(aviso.id, idAspirante);
      setAvisos((prev) => prev.map((a) => (a.id === aviso.id ? { ...a, leido: true } : a)));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Avisos</Text>
        <View style={{ width: 22 }} />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={ColoresApp.primario} />
      ) : avisos.length === 0 ? (
        <Text style={styles.emptyText}>No hay avisos por ahora.</Text>
      ) : (
        <FlatList
          data={avisos}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => <AvisoCard aviso={item} onAbrir={() => abrirAviso(item)} />}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        />
      )}

      {avisoAbierto && (
        <Pressable style={styles.modalBackdrop} onPress={() => setAvisoAbierto(null)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitulo}>{avisoAbierto.titulo}</Text>
            <Text style={styles.modalFecha}>{formatDate(avisoAbierto.creado_en)}</Text>
            <Text style={styles.modalContenido}>{avisoAbierto.contenido}</Text>
            <Pressable style={styles.modalCerrar} onPress={() => setAvisoAbierto(null)}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ColoresApp.fondo },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: ColoresApp.borde,
  },
  topBarTitulo: { fontSize: 16, fontWeight: '700', color: ColoresApp.oscuro },
  emptyText: { marginTop: 100, textAlign: 'center', color: ColoresApp.textoSecundario },
  listContainer: { padding: 16, gap: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    padding: 14,
    marginBottom: 12,
  },
  cardNoLeida: { borderColor: ColoresApp.primario },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puntoNoLeido: { width: 8, height: 8, borderRadius: 4, backgroundColor: ColoresApp.primario },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: ColoresApp.oscuro, flex: 1 },
  cardContenido: { fontSize: 13, color: ColoresApp.texto, marginTop: 6 },
  cardFecha: { fontSize: 11, color: ColoresApp.textoSecundario, marginTop: 8 },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    gap: 10,
  },
  modalTitulo: { fontSize: 16, fontWeight: '700', color: ColoresApp.oscuro },
  modalFecha: { fontSize: 11, color: ColoresApp.textoSecundario },
  modalContenido: { fontSize: 14, color: ColoresApp.texto, lineHeight: 20 },
  modalCerrar: {
    alignSelf: 'flex-end',
    backgroundColor: ColoresApp.primario,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 8,
  },
});
