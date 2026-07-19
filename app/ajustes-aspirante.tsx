import { ColoresApp } from '@/constants/coloresApp';
import {
  cerrarTodasLasSesiones,
  obtenerSesionAspirante,
} from '@/services/sesionServicio';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Pantalla "Ajustes" del aspirante. Antes el ítem del menú no hacía nada
 * (era decorativo); ahora reúne lo que sí le sirve a un aspirante:
 * ver los datos con los que entró (folio/correo), un acceso directo a
 * soporte, y cerrar sesión.
 */

function confirmar(titulo: string, mensaje: string, onOk: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${titulo}\n${mensaje}`)) onOk();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar sesión', style: 'destructive', onPress: onOk },
  ]);
}

const Fila = ({
  icon,
  label,
  valor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  valor: string;
}) => (
  <View style={styles.fila}>
    <Ionicons name={icon} size={16} color={ColoresApp.textoSecundario} />
    <View style={{ marginLeft: 10, flex: 1 }}>
      <Text style={styles.filaLabel}>{label}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  </View>
);

const Opcion = ({
  icon,
  texto,
  destructivo,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  texto: string;
  destructivo?: boolean;
  onPress: () => void;
}) => (
  <Pressable style={styles.opcion} onPress={onPress}>
    <Ionicons
      name={icon}
      size={18}
      color={destructivo ? '#DC2626' : ColoresApp.primario}
    />
    <Text style={[styles.opcionTexto, destructivo && { color: '#DC2626' }]}>{texto}</Text>
    <Ionicons name="chevron-forward" size={16} color={ColoresApp.textoSecundario} />
  </Pressable>
);

export default function AjustesAspiranteScreen() {
  const router = useRouter();
  const [folio, setFolio] = useState('');
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    (async () => {
      const sesion = await obtenerSesionAspirante();
      if (sesion) {
        setFolio((sesion as any).folio ?? '—');
        setCorreo((sesion as any).correo ?? '—');
        setNombre((sesion as any).nombre ?? '—');
      }
    })();
  }, []);

  const salir = () => {
    confirmar(
      '¿Cerrar sesión?',
      'Vas a salir de tu cuenta en este dispositivo.',
      async () => {
        await cerrarTodasLasSesiones();
        router.replace('/login');
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={ColoresApp.oscuro} />
        </Pressable>
        <Text style={styles.topBarTitulo}>Ajustes</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.seccionLabel}>Tu cuenta</Text>
        <View style={styles.card}>
          <Fila icon="person-outline" label="Nombre" valor={nombre || '—'} />
          <View style={styles.separador} />
          <Fila icon="barcode-outline" label="Folio" valor={folio || '—'} />
          <View style={styles.separador} />
          <Fila icon="mail-outline" label="Correo" valor={correo || '—'} />
        </View>

        <Text style={styles.seccionLabel}>Ayuda</Text>
        <View style={styles.card}>
          <Opcion
            icon="help-circle-outline"
            texto="Manual de usuario"
            onPress={() => router.push('/documentos-aspirante')}
          />
          <View style={styles.separador} />
          <Opcion
            icon="mail-open-outline"
            texto="Contactar soporte"
            onPress={() => Linking.openURL('mailto:soporte@admisiones.edu.mx')}
          />
        </View>

        <Text style={styles.seccionLabel}>Sesión</Text>
        <View style={styles.card}>
          <Opcion icon="log-out-outline" texto="Cerrar sesión" destructivo onPress={salir} />
        </View>
      </ScrollView>
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
  scrollContent: { padding: 16, paddingBottom: 40 },
  seccionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ColoresApp.textoSecundario,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  separador: { height: 1, backgroundColor: ColoresApp.borde },
  fila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  filaLabel: { fontSize: 11, color: ColoresApp.textoSecundario },
  filaValor: { fontSize: 13, color: ColoresApp.oscuro, fontWeight: '600', marginTop: 2 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  opcionTexto: { flex: 1, fontSize: 13, color: ColoresApp.oscuro, fontWeight: '600' },
});
