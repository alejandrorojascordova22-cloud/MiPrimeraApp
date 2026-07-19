import { supabase } from './supabaseClient';

/**
 * Materiales de estudio (documentos, audio, imagen, video, etc. subidos por
 * el admin para que los aspirantes descarguen). Usado por gestionar-materiales.tsx.
 * Migrado de la parte "materiales de estudio" de lib/datos/supabase_service.dart
 *
 * NOTA sobre `bytes` en React Native: en Flutter se mandaba un Uint8List.
 * En Expo, normalmente obtienes un archivo local con expo-document-picker
 * (te da un `uri`), y antes de subirlo lo conviertes así:
 *   const respuesta = await fetch(uri);
 *   const bytes = await respuesta.blob(); // <- esto es lo que se manda aquí
 */

export const BUCKET_MATERIALES_ESTUDIO = 'materiales_estudio';
export const TABLA_MATERIALES_ESTUDIO = 'materiales_estudio';

/** Extensiones sugeridas por tipo, usadas por el selector de archivos. */
export const EXTENSIONES_POR_TIPO_MATERIAL: Record<string, string[]> = {
  pdf: ['pdf'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'aac'],
  imagen: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  video: ['mp4', 'mov', 'avi', 'mkv'],
  otro: [],
};

export const ETIQUETAS_POR_TIPO_MATERIAL: Record<string, string> = {
  pdf: 'PDF',
  audio: 'Audio',
  imagen: 'Imagen',
  video: 'Video',
  otro: 'Otro',
};

function rutaUnicaMaterial(nombreOriginal: string): string {
  const limpio = nombreOriginal.replace(/[^\w.\-]/g, '_');
  return `${Date.now()}_${limpio}`;
}

/** Lista todos los materiales de estudio, más recientes primero. */
export async function obtenerMaterialesEstudio(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .select()
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn('Error en obtenerMaterialesEstudio:', e);
    return [];
  }
}

/** Obtiene el enlace público del PDF de guía de estudio más reciente. */
export async function obtenerUrlGuiaEstudio(): Promise<string | null> {
  try {
    const { data: fila, error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .select('url_publica')
      .eq('tipo', 'pdf')
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return fila?.url_publica ?? null;
  } catch (e) {
    console.warn('Error al obtener la URL de la guía de estudio:', e);
    return null;
  }
}

interface SubirMaterialEstudioParams {
  titulo: string;
  descripcion?: string;
  tipo: string;
  nombreArchivoOriginal: string;
  bytes: Blob | ArrayBuffer;
  mimeType?: string;
  materia?: string;
  aplicaATodas?: boolean;
  carrerasIds?: number[];
}

/**
 * Sube un nuevo material de estudio (cualquier tipo de archivo) y crea
 * su registro de metadata en la tabla 'materiales_estudio'.
 */
export async function subirMaterialEstudio({
  titulo,
  descripcion,
  tipo,
  nombreArchivoOriginal,
  bytes,
  mimeType,
  materia,
  aplicaATodas = true,
  carrerasIds = [],
}: SubirMaterialEstudioParams): Promise<Record<string, any> | null> {
  try {
    const rutaStorage = rutaUnicaMaterial(nombreArchivoOriginal);
    const { error: errorUpload } = await supabase.storage
      .from(BUCKET_MATERIALES_ESTUDIO)
      .upload(rutaStorage, bytes, { contentType: mimeType, upsert: true });
    if (errorUpload) throw errorUpload;

    const {
      data: { publicUrl: urlPublica },
    } = supabase.storage.from(BUCKET_MATERIALES_ESTUDIO).getPublicUrl(rutaStorage);

    const tamanoBytes = bytes instanceof Blob ? bytes.size : bytes.byteLength;

    const { data: res, error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .insert({
        titulo,
        descripcion,
        tipo,
        materia,
        aplica_a_todas: aplicaATodas,
        nombre_archivo: nombreArchivoOriginal,
        ruta_storage: rutaStorage,
        url_publica: urlPublica,
        mime_type: mimeType,
        tamano_bytes: tamanoBytes,
      })
      .select()
      .maybeSingle();
    if (error) throw error;

    // Si el material es específico de una o varias carreras, se guarda
    // la relación en material_carreras (aplica_a_todas ya quedó en false).
    if (res && !aplicaATodas && carrerasIds.length > 0) {
      await asignarCarrerasMaterial(res.id, { aplicaATodas: false, carrerasIds });
    }

    return res ?? null;
  } catch (e) {
    console.warn('Error en subirMaterialEstudio:', e);
    return null;
  }
}

interface ReemplazarArchivoMaterialParams {
  materialActual: Record<string, any>;
  nombreArchivoOriginal: string;
  bytes: Blob | ArrayBuffer;
  mimeType?: string;
}

/**
 * Reemplaza el archivo de un material existente (borra el anterior del
 * storage y sube el nuevo), conservando el mismo registro/id.
 */
export async function reemplazarArchivoMaterial({
  materialActual,
  nombreArchivoOriginal,
  bytes,
  mimeType,
}: ReemplazarArchivoMaterialParams): Promise<boolean> {
  try {
    const rutaAnterior = materialActual.ruta_storage as string | undefined;
    if (rutaAnterior) {
      try {
        await supabase.storage.from(BUCKET_MATERIALES_ESTUDIO).remove([rutaAnterior]);
      } catch {
        // Si falla borrar el archivo anterior, seguimos: subir el nuevo importa más.
      }
    }

    const rutaStorage = rutaUnicaMaterial(nombreArchivoOriginal);
    const { error: errorUpload } = await supabase.storage
      .from(BUCKET_MATERIALES_ESTUDIO)
      .upload(rutaStorage, bytes, { contentType: mimeType, upsert: true });
    if (errorUpload) throw errorUpload;

    const {
      data: { publicUrl: urlPublica },
    } = supabase.storage.from(BUCKET_MATERIALES_ESTUDIO).getPublicUrl(rutaStorage);

    const tamanoBytes = bytes instanceof Blob ? bytes.size : bytes.byteLength;

    const { error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .update({
        nombre_archivo: nombreArchivoOriginal,
        ruta_storage: rutaStorage,
        url_publica: urlPublica,
        mime_type: mimeType,
        tamano_bytes: tamanoBytes,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', materialActual.id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en reemplazarArchivoMaterial:', e);
    return false;
  }
}

interface ActualizarInfoMaterialParams {
  id: number;
  titulo: string;
  descripcion?: string;
}

/** Actualiza solo título/descripción de un material (sin tocar el archivo). */
export async function actualizarInfoMaterial({
  id,
  titulo,
  descripcion,
}: ActualizarInfoMaterialParams): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .update({
        titulo,
        descripcion,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en actualizarInfoMaterial:', e);
    return false;
  }
}

/** Elimina un material de estudio (archivo del storage + su registro). */
export async function eliminarMaterialEstudio(
  material: Record<string, any>
): Promise<boolean> {
  try {
    const ruta = material.ruta_storage as string | undefined;
    if (ruta) {
      try {
        await supabase.storage.from(BUCKET_MATERIALES_ESTUDIO).remove([ruta]);
      } catch {
        // Si falla borrar el archivo, seguimos y borramos el registro igual.
      }
    }
    const { error } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .delete()
      .eq('id', material.id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en eliminarMaterialEstudio:', e);
    return false;
  }
}

// =====================================================================
// Alcance por carrera (general vs específico)
// =====================================================================

/**
 * Define a qué carreras aplica un material. Si `aplicaATodas` es true,
 * el material se ve para todas las carreras y se limpia cualquier
 * asignación específica anterior en `material_carreras`.
 */
export async function asignarCarrerasMaterial(
  materialId: number,
  { aplicaATodas, carrerasIds = [] }: { aplicaATodas: boolean; carrerasIds?: number[] }
): Promise<boolean> {
  try {
    const { error: errorUpdate } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .update({ aplica_a_todas: aplicaATodas })
      .eq('id', materialId);
    if (errorUpdate) throw errorUpdate;

    // Siempre se limpia primero: evita dejar carreras "colgadas" de una
    // asignación anterior si el admin cambia de "específico" a "todas".
    const { error: errorDelete } = await supabase
      .from('material_carreras')
      .delete()
      .eq('material_id', materialId);
    if (errorDelete) throw errorDelete;

    if (!aplicaATodas && carrerasIds.length > 0) {
      const filas = carrerasIds.map((carreraId) => ({
        material_id: materialId,
        carrera_id: carreraId,
      }));
      const { error: errorInsert } = await supabase.from('material_carreras').insert(filas);
      if (errorInsert) throw errorInsert;
    }
    return true;
  } catch (e) {
    console.warn('Error en asignarCarrerasMaterial:', e);
    return false;
  }
}

/**
 * Materiales visibles para una carrera: los "generales" (aplica_a_todas)
 * más los específicos de esa carrera. También filtra por ventana de
 * disponibilidad si `disponible_desde`/`disponible_hasta` están definidos.
 */
export async function obtenerMaterialesParaCarrera(
  carreraId: number
): Promise<Record<string, any>[]> {
  try {
    const { data: idsEspecificos, error: e1 } = await supabase
      .from('material_carreras')
      .select('material_id')
      .eq('carrera_id', carreraId);
    if (e1) throw e1;

    const idsEspecificosArr = (idsEspecificos ?? []).map((f) => f.material_id);

    let query = supabase.from(TABLA_MATERIALES_ESTUDIO).select();
    if (idsEspecificosArr.length > 0) {
      query = query.or(
        `aplica_a_todas.eq.true,id.in.(${idsEspecificosArr.join(',')})`
      );
    } else {
      query = query.eq('aplica_a_todas', true);
    }

    const { data, error } = await query.order('creado_en', { ascending: false });
    if (error) throw error;

    const ahora = new Date();
    return (data ?? []).filter((m) => {
      if (m.disponible_desde && new Date(m.disponible_desde) > ahora) return false;
      if (m.disponible_hasta && new Date(m.disponible_hasta) < ahora) return false;
      return true;
    });
  } catch (e) {
    console.warn('Error en obtenerMaterialesParaCarrera:', e);
    return [];
  }
}

// =====================================================================
// Progreso del aspirante (qué ya vio) + analítica para admin
// =====================================================================

/** Marca un material como visto por un aspirante (idempotente). */
export async function registrarMaterialVisto(
  materialId: number,
  aspiranteId: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('material_progreso')
      .upsert(
        [{ material_id: materialId, aspirante_id: aspiranteId, visto_en: new Date().toISOString() }],
        { onConflict: 'material_id,aspirante_id' }
      );
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Error en registrarMaterialVisto:', e);
    return false;
  }
}

/** IDs de materiales que un aspirante ya marcó como vistos. */
export async function obtenerMaterialesVistosPorAspirante(
  aspiranteId: number
): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('material_progreso')
      .select('material_id')
      .eq('aspirante_id', aspiranteId);
    if (error) throw error;
    return (data ?? []).map((f) => f.material_id as number);
  } catch (e) {
    console.warn('Error en obtenerMaterialesVistosPorAspirante:', e);
    return [];
  }
}

export interface MaterialConVistas {
  id: number;
  titulo: string;
  tipo: string;
  total_vistas: number;
}

/**
 * Ranking de materiales más vistos, para el panel de admin ("qué
 * materiales revisan más los aspirantes"). Cuenta filas de
 * material_progreso agrupadas por material.
 */
export async function obtenerMaterialesMasVistos(
  limite = 20
): Promise<MaterialConVistas[]> {
  try {
    const { data: progreso, error: e1 } = await supabase
      .from('material_progreso')
      .select('material_id');
    if (e1) throw e1;

    const conteo = new Map<number, number>();
    for (const fila of progreso ?? []) {
      const id = fila.material_id as number;
      conteo.set(id, (conteo.get(id) ?? 0) + 1);
    }
    if (conteo.size === 0) return [];

    const { data: materiales, error: e2 } = await supabase
      .from(TABLA_MATERIALES_ESTUDIO)
      .select('id, titulo, tipo')
      .in('id', Array.from(conteo.keys()));
    if (e2) throw e2;

    return (materiales ?? [])
      .map((m) => ({
        id: m.id,
        titulo: m.titulo,
        tipo: m.tipo,
        total_vistas: conteo.get(m.id) ?? 0,
      }))
      .sort((a, b) => b.total_vistas - a.total_vistas)
      .slice(0, limite);
  } catch (e) {
    console.warn('Error en obtenerMaterialesMasVistos:', e);
    return [];
  }
}