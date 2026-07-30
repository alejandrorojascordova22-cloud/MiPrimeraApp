import React, { createContext, useContext } from 'react';
import { TemaConfig, temaConfigPorDefecto } from '../services/temaConfig';

/**
 * Contexto global de apariencia. `_layout.tsx` ya carga el tema del rol
 * activo con `useTemaControlador` (incluye Realtime); este contexto solo
 * lo re-expone para que CUALQUIER pantalla pueda leer los colores/fondo
 * configurados en Ajustes del Sistema sin volver a pedirlo a Supabase.
 *
 * Antes de esto, cada pantalla dibujaba su propio fondo y colores fijos
 * (constantes locales tipo `TEMA` o `ColoresApp`), por lo que lo que el
 * admin configuraba en "Apariencia del Sistema" nunca se veía reflejado.
 */
const TemaContext = createContext<TemaConfig>(temaConfigPorDefecto('admin'));

export function TemaProvider({
  tema,
  children,
}: {
  tema: TemaConfig;
  children: React.ReactNode;
}) {
  return React.createElement(TemaContext.Provider, { value: tema }, children);
}

export function useTema(): TemaConfig {
  return useContext(TemaContext);
}
