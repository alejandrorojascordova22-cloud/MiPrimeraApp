import { ColoresApp } from '@/constants/coloresApp';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { obtenerCarreras } from '@/services/carrerasServicio';

const iconosPorTipo: Record<string, keyof typeof Ionicons.glyphMap> = {
  ingenieria: 'laptop-outline',
  tecnologia: 'shield-outline',
  negocios: 'globe-outline',
};

type Carrera = { id: number; nombre: string; tipo?: string; icono: keyof typeof Ionicons.glyphMap; descripcion: string };

export default function PantallaSeleccionCarrera() {
  const router = useRouter();
  const { nombreAspirante = 'Aspirante' } = useLocalSearchParams<{ nombreAspirante?: string }>();
  const { width } = useWindowDimensions();

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<number | null>(null);

  useEffect(() => {
    const cargar = async () => {
      const datos = await obtenerCarreras();
      setCarreras(
        datos.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          icono: iconosPorTipo[c.tipo ?? ''] ?? 'school-outline',
          descripcion: c.tipo ?? '',
        }))
      );
      setCargando(false);
    };
    cargar();
  }, []);

  const continuarProceso = () => {
    if (!carreraSeleccionada) {
      Alert.alert('Atención', 'Por favor, selecciona una carrera para continuar.');
      return;
    }

    router.push({
      pathname: '/registro-aspirante',
      params: { nombreAspirante, idCarrera: String(carreraSeleccionada) },
    });
  };

  const esAncho = width >= 560;

  if (cargando) {
    return (
      <SafeAreaView style={[styles.contenedorPrincipal, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ColoresApp.primario} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <Stack.Screen
        options={{
          title: 'Selección de carrera',
          headerStyle: { backgroundColor: ColoresApp.primario },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerTitleAlign: 'center',
        }}
      />
      <View style={styles.contenido}>
        <Text style={styles.saludo}>Hola, {nombreAspirante}</Text>
        <Text style={styles.titulo}>Elige tu destino profesional</Text>
        <Text style={styles.descripcion}>
          Selecciona el programa académico para el cual vas a presentar tu examen de admisión.
        </Text>

        <FlatList
          key={esAncho ? 'GRID' : 'LIST'}
          data={carreras}
          numColumns={esAncho ? 2 : 1}
          contentContainerStyle={styles.lista}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={esAncho ? styles.itemGrid : styles.itemList}>
              <TarjetaCarrera
                carrera={item}
                estaSeleccionada={carreraSeleccionada === item.id}
                onPress={() => setCarreraSeleccionada(item.id)}
              />
            </View>
          )}
        />

        <Pressable
          onPress={continuarProceso}
          style={({ pressed }) => [styles.boton, pressed && { opacity: 0.9 }]}>
          <Text style={styles.textoBoton}>Confirmar y continuar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TarjetaCarrera({
  carrera,
  estaSeleccionada,
  onPress,
}: {
  carrera: Carrera;
  estaSeleccionada: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tarjeta,
        estaSeleccionada && styles.tarjetaSeleccionada,
      ]}>
      <View style={styles.filaTarjeta}>
        <View
          style={[
            styles.iconoContenedor,
            { backgroundColor: estaSeleccionada ? ColoresApp.primario : '#F2F5FA' },
          ]}>
          <Ionicons
            name={carrera.icono}
            size={18}
            color={estaSeleccionada ? '#fff' : ColoresApp.textoSecundario}
          />
        </View>
        <View style={styles.textoContenedor}>
          <Text style={[styles.nombreCarrera, { color: estaSeleccionada ? ColoresApp.primario : ColoresApp.oscuro }]}>
            {carrera.nombre}
          </Text>
          <Text style={[styles.descripcionCarrera, estaSeleccionada && { color: ColoresApp.primario }]}>
            {carrera.descripcion}
          </Text>
        </View>
        <Ionicons
          name={estaSeleccionada ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={estaSeleccionada ? ColoresApp.primario : '#D1D5DB'}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedorPrincipal: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contenido: {
    flex: 1,
    padding: 20,
  },
  saludo: {
    fontSize: 13,
    fontWeight: '500',
    color: ColoresApp.textoSecundario,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: ColoresApp.oscuro,
    marginTop: 2,
  },
  descripcion: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 20,
  },
  lista: {
    paddingBottom: 20,
  },
  itemList: {
    marginBottom: 12,
  },
  itemGrid: {
    flex: 1,
    margin: 6,
    maxWidth: '50%',
  },
  boton: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBoton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tarjeta: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tarjetaSeleccionada: {
    borderColor: ColoresApp.primario,
    borderWidth: 1.5,
    backgroundColor: ColoresApp.primarioFondo,
  },
  filaTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconoContenedor: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoContenedor: {
    flex: 1,
  },
  nombreCarrera: {
    fontSize: 14,
    fontWeight: '600',
  },
  descripcionCarrera: {
    fontSize: 11,
    color: ColoresApp.textoSecundario,
    marginTop: 2,
  },
});