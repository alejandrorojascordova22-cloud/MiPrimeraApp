import { CampoTexto } from '@/components/CampoTexto';
import { ColoresApp } from '@/constants/coloresApp';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { obtenerCarreras } from '@/services/carrerasServicio';
import { registrarAspirante, obtenerAspirantePorId } from '@/services/aspirantesServicio';
import { enviarCorreoConfirmacionRegistro } from '@/services/correoServicio';
type Carrera = { id: number; nombre: string };

export default function PantallaRegistroAspirante() {
  const router = useRouter();
  const { aspiranteId } = useLocalSearchParams<{ aspiranteId?: string }>();
  const esEdicion = !!aspiranteId;

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraSeleccionadaId, setCarreraSeleccionadaId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const listaCarreras = (await obtenerCarreras()) as Carrera[];
        setCarreras(listaCarreras);

        if (esEdicion) {
          const aspirante = await obtenerAspirantePorId(parseInt(aspiranteId, 10));
          if (aspirante) {
            setNombre(aspirante.nombre);
            setCorreo(aspirante.correo);
            setCarreraSeleccionadaId(aspirante.carrera_id);
          }
        } else if (listaCarreras.length > 0) {
          setCarreraSeleccionadaId(listaCarreras[0].id);
        }
      } catch (error) {
        console.error('Error al cargar datos:', error);
        Alert.alert('Error', 'No se pudieron cargar los datos necesarios.');
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [aspiranteId, esEdicion]);

  const guardar = async () => {
    if (!nombre.trim() || !correo.trim()) {
      Alert.alert('Campos incompletos', 'El nombre y el correo son obligatorios.');
      return;
    }
    if (!correo.includes('@')) {
      Alert.alert('Correo inválido', 'Por favor, ingresa un correo electrónico válido.');
      return;
    }
    if (carreraSeleccionadaId === null) {
      Alert.alert('Sin carrera', 'Debes seleccionar una carrera.');
      return;
    }

    setGuardando(true);
    try {
      const resultado = await registrarAspirante({
        id: esEdicion ? parseInt(aspiranteId, 10) : undefined,
        nombre,
        correo,
        idCarrera: carreraSeleccionadaId,
      });

      if (resultado) {
        if (!esEdicion) {
          const carreraNombre = carreras.find((c) => c.id === carreraSeleccionadaId)?.nombre ?? '';
          await enviarCorreoConfirmacionRegistro({
            nombre,
            correo,
            folio: resultado.folio,
            carrera: carreraNombre,
          });
        }
        Alert.alert('Éxito', `Aspirante ${esEdicion ? 'actualizado' : 'registrado'} correctamente.`);
        router.back();
      } else {
        Alert.alert('Error', 'No se pudo guardar el aspirante.');
      }
    } catch (e: any) {
      Alert.alert('Error', `Ocurrió un problema: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <View style={styles.centrado}><ActivityIndicator size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[ColoresApp.primario, ColoresApp.oscuroClaro]} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.botonAtras}>
          <Ionicons name="arrow-back" color="white" size={20} />
        </Pressable>
        <Text style={styles.headerTexto}>{esEdicion ? 'Editar aspirante' : 'Registrar aspirante'}</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.contenidoScroll}>
        <View style={styles.formContainer}>
          <Text style={styles.tituloSeccion}>DATOS PERSONALES</Text>
          <CampoTexto
            etiqueta="Nombre completo"
            valor={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del aspirante"
            icono="person-outline"
          />
          <View style={{ height: 16 }} />
          <CampoTexto
            etiqueta="Correo electrónico"
            valor={correo}
            onChangeText={setCorreo}
            placeholder="correo@ejemplo.com"
            icono="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.tituloSeccion, { marginTop: 24 }]}>ASIGNACIÓN ACADÉMICA</Text>
          {carreras.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCarreraSeleccionadaId(c.id)}
              style={[
                styles.opcionCarrera,
                carreraSeleccionadaId === c.id && styles.opcionCarreraSeleccionada,
              ]}>
              <Text
                style={[
                  styles.textoOpcionCarrera,
                  carreraSeleccionadaId === c.id && { color: ColoresApp.primario, fontWeight: 'bold' },
                ]}>
                {c.nombre}
              </Text>
            </Pressable>
          ))}

          <View style={{ height: 32 }} />

          <Pressable
            onPress={guardar}
            disabled={guardando}
            style={({ pressed }) => [styles.boton, (guardando || pressed) && { opacity: 0.8 }]}>
            {guardando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.textoBoton}>{esEdicion ? 'Guardar Cambios' : 'Registrar Aspirante'}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedorPrincipal: { flex: 1, backgroundColor: ColoresApp.fondo },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  botonAtras: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexto: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  contenidoScroll: { padding: 24, alignItems: 'center' },
  formContainer: { width: '100%', maxWidth: 640 },
  tituloSeccion: {
    fontSize: 12,
    fontWeight: '600',
    color: ColoresApp.primario,
    marginBottom: 14,
    letterSpacing: 0.4,
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
    fontSize: 15,
    fontWeight: '500',
  },
  opcionCarrera: {
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  opcionCarreraSeleccionada: {
    borderColor: ColoresApp.primario,
    borderWidth: 2,
    backgroundColor: ColoresApp.primarioFondo,
  },
  textoOpcionCarrera: {
    fontSize: 14,
    color: ColoresApp.texto,
  },
});