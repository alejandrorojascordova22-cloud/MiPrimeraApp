import { CampoTexto } from '@/components/CampoTexto';
import { ColoresApp } from '@/constants/coloresApp';
import { verificarLoginAdmin, iniciarSesionAuthAdmin } from '@/services/adminAuthServicio';
import { cerrarTodasLasSesiones, guardarSesionAdmin } from '@/services/sesionServicio';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function PantallaLoginAdmin() {
  const router = useRouter();
  const { sesionInvalida } = useLocalSearchParams<{ sesionInvalida?: string }>();

  // --- Estado ---
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verContrasena, setVerContrasena] = useState(false);
  // Si venimos rebotados desde /panel porque la sesión guardada ya no era
  // válida (cuenta eliminada o desactivada), avisamos con un mensaje claro
  // en vez de dejar que la persona piense que el login "no sirve". Esto se
  // calcula directo al inicializar el estado (no en un useEffect) porque
  // depende únicamente del parámetro de la ruta al montar la pantalla; no
  // hace falta "sincronizar con un sistema externo", así que un efecto
  // aquí solo generaba un render extra en cascada sin necesidad.
  const [mensajeError, setMensajeError] = useState(() =>
    sesionInvalida === '1'
      ? 'Tu sesión ya no es válida (la cuenta fue eliminada o desactivada). Vuelve a iniciar sesión.'
      : '',
  );

  const iniciarSesion = async () => {
    setCargando(true);
    setMensajeError('');

    if (!usuario || !contrasena) {
      setMensajeError('Ingresa usuario y contraseña.');
      setCargando(false);
      return;
    }

    try {
      const admin = await verificarLoginAdmin({
        correo: usuario.trim().toLowerCase(),
        contrasena: contrasena.trim(),
      });

      if (admin) {
        // Inicia también una sesión real de Supabase Auth (anónima,
        // vinculada al admin) para que las políticas RLS que usan
        // auth.uid() funcionen, p. ej. al registrar asistencia por QR.
        const authOk = await iniciarSesionAuthAdmin(admin.id);
        if (!authOk) {
          console.warn(
            'No se pudo iniciar sesión de Supabase Auth para este admin. ' +
              'Algunas acciones (como registrar asistencia) podrían fallar.',
          );
        }

        await cerrarTodasLasSesiones();
        await guardarSesionAdmin(admin);
        router.replace('/panel');
      } else {
        setMensajeError('Usuario o contraseña de administrador incorrectos.');
      }
    } catch (error: any) {
      console.error('Error detallado en login:', error);
      setMensajeError(error.message || 'Error técnico al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.contenedorPrincipal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : (Platform.OS === 'android' ? 'height' : undefined)}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <LinearGradient
            colors={[ColoresApp.oscuro, ColoresApp.oscuroClaro]}
            style={styles.areaEncabezado}>
            <View style={styles.iconoContenedor}>
              <Ionicons name="shield-checkmark-outline" color="white" size={36} />
            </View>
            <Text style={styles.textoEncabezado}>Acceso administrativo</Text>
            <Text style={styles.subtextoEncabezado}>Área de Vinculación — UTO</Text>
          </LinearGradient>

          <View style={styles.tarjetaLogin}>
            <View style={styles.contenidoTarjeta}>
              <Text style={styles.tituloTarjeta}>Iniciar sesión</Text>
              <Text style={styles.subtituloTarjeta}>Solo personal autorizado de Vinculación.</Text>

              <CampoTexto
                etiqueta="IDENTIFICADOR O CORREO"
                placeholder="vinculacion o admin@uto.com"
                icono="person-outline"
                valor={usuario}
                onChangeText={setUsuario}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
              />

              <View style={{ height: 16 }} />

              <CampoTexto
                etiqueta="CONTRASEÑA"
                placeholder="••••••••"
                icono="lock-closed-outline"
                valor={contrasena}
                onChangeText={setContrasena}
                secureTextEntry={!verContrasena}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                iconoFinal={verContrasena ? 'eye-off-outline' : 'eye-outline'}
                onPressIconoFinal={() => setVerContrasena(!verContrasena)}
              />

              {mensajeError ? <Text style={styles.textoError}>{mensajeError}</Text> : null}

              <Pressable
                onPress={() => router.push('/recuperar-password-admin')}
                style={{ alignSelf: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: ColoresApp.primario, fontSize: 13, fontWeight: '600' }}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </Pressable>

              <Pressable
                onPress={iniciarSesion}
                disabled={cargando}
                style={({ pressed }) => [styles.boton, (cargando || pressed) && { opacity: 0.8 }]}>
                {cargando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.textoBoton}>Entrar al panel</Text>
                )}
              </Pressable>

              <View style={styles.notaSeguridad}>
                <Ionicons name="lock-closed-outline" color={ColoresApp.advertencia} size={16} />
                <Text style={styles.textoNotaSeguridad}>
                  Esta sección es exclusiva para personal de Vinculación. El acceso es registrado.
                </Text>
              </View>

              <Pressable onPress={() => router.back()} style={styles.botonRegresar}>
                <Text style={styles.textoRegresar}>← Regresar</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedorPrincipal: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  areaEncabezado: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconoContenedor: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoEncabezado: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 14,
  },
  subtextoEncabezado: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  tarjetaLogin: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  contenidoTarjeta: {
    width: '100%',
    maxWidth: 480,
  },
  tituloTarjeta: {
    fontSize: 20,
    fontWeight: '500',
    color: ColoresApp.texto,
  },
  subtituloTarjeta: {
    color: 'grey',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 28,
  },
  textoError: {
    color: 'red',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  boton: {
    backgroundColor: ColoresApp.primario,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  textoBoton: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  notaSeguridad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FBEFDD',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#F3DDB3',
    padding: 12,
    marginTop: 20,
  },
  textoNotaSeguridad: {
    flex: 1,
    fontSize: 12,
    color: ColoresApp.advertencia,
    marginLeft: 8,
    lineHeight: 18,
  },
  botonRegresar: {
    alignSelf: 'center',
    marginTop: 16,
  },
  textoRegresar: {
    color: 'grey',
  },
});