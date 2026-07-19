import { supabase } from "./supabaseClient";

export type ActividadCronograma = {
  id: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  titulo: string;
  descripcion?: string | null;
  color_etiqueta?: string | null;
  creado_en: string;
};

/**
 * Obtiene todas las actividades del cronograma, ordenadas por fecha de inicio.
 */
export async function obtenerCronograma(): Promise<ActividadCronograma[]> {
  try {
    const { data, error } = await supabase
      .from("cronograma_actividades")
      .select("*")
      .order("fecha_inicio", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn("Error en obtenerCronograma:", e);
    return [];
  }
}

type ActividadPayload = Omit<ActividadCronograma, "id" | "creado_en">;

/**
 * Crea una nueva actividad en el cronograma.
 */
export async function crearActividad(
  actividad: ActividadPayload
): Promise<ActividadCronograma | null> {
  try {
    const { data, error } = await supabase
      .from("cronograma_actividades")
      .insert(actividad)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.warn("Error en crearActividad:", e);
    return null;
  }
}

/**
 * Actualiza una actividad existente.
 */
export async function actualizarActividad(
  id: number,
  cambios: Partial<ActividadPayload>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("cronograma_actividades")
      .update(cambios)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Error en actualizarActividad:", e);
    return false;
  }
}

/**
 * Elimina una actividad del cronograma.
 */
export async function eliminarActividad(id: number): Promise<boolean> {
  try {
    const { error } = await supabase.from("cronograma_actividades").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Error en eliminarActividad:", e);
    return false;
  }
}