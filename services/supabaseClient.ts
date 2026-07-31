import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://ratcjkiihtgvpkirxubs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_atDapRBqMM2aJihejvPhLQ_BpHx5WnG';

const authStorage =
  Platform.OS === 'web'
    ? typeof window === 'undefined'
      ? {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        }
      : undefined
    : AsyncStorage;

// Exportados para poder armar peticiones manuales (p.ej. subida con progreso
// vía XMLHttpRequest a una URL firmada, que el SDK de supabase-js no soporta).
export { SUPABASE_URL, SUPABASE_ANON_KEY };

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});