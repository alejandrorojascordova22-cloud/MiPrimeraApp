import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColoresApp } from '@/constants/coloresApp';

interface CampoTextoProps extends Omit<TextInputProps, 'value'> {
  etiqueta?: string;
  error?: string;
  valor?: string;
  icono?: keyof typeof Ionicons.glyphMap;
  iconoFinal?: keyof typeof Ionicons.glyphMap;
  onPressIconoFinal?: () => void;
}

export const CampoTexto = React.forwardRef<TextInput, CampoTextoProps>(
  function CampoTexto(
    {
      etiqueta,
      error,
      valor,
      icono,
      iconoFinal,
      onPressIconoFinal,
      style,
      ...rest
    },
    ref,
  ) {
    return (
      <View style={styles.contenedor}>
        {etiqueta ? <Text style={styles.etiqueta}>{etiqueta}</Text> : null}
        <View style={[styles.inputRow, error ? styles.inputError : null]}>
          {icono ? (
            <Ionicons
              name={icono}
              size={20}
              color="#8A94A6"
              style={styles.iconoIzq}
            />
          ) : null}
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor="#8A94A6"
            value={valor}
            {...rest}
          />
          {iconoFinal ? (
            <TouchableOpacity onPress={onPressIconoFinal} hitSlop={8}>
              <Ionicons name={iconoFinal} size={20} color="#8A94A6" />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  contenedor: { marginBottom: 16 },
  etiqueta: {
    fontSize: 14,
    fontWeight: '600',
    color: ColoresApp.texto,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ColoresApp.borde,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  iconoIzq: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: ColoresApp.texto,
  },
  inputError: { borderColor: '#D64545' },
  error: { color: '#D64545', fontSize: 12, marginTop: 4 },
});