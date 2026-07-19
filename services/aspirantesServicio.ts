import { supabase } from "./supabaseClient";

/**
 * Todo lo relacionado con el aspirante: registro, login (validarFolio),
 * asistencia por QR y consultas para el panel de administración.
 * Migrado de la parte "aspirantes" de lib/datos/supabase_service.dart
 */

/** Genera un folio único para el periodo de admisión actual. */
export function generarFolioUnico(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `UTO-2026-${timestamp.slice(-6)}${random}`;
}

interface RegistrarAspiranteParams {
  id?: number;
  nombre: string;
  correo: string;
  idCarrera: number;
  folio?: string;
}

/**
 * Inserta o actualiza un aspirante en la tabla 'aspirantes'.
 * Valida que la carrera exista antes de registrar.
 */
export async function registrarAspirante({
  id,
  nombre,
  correo,
  idCarrera,
  folio,
}: RegistrarAspiranteParams): Promise<Record<string, any> | null> {
  try {
    // 1. Validar que la carrera existe
    const { data: carreraExiste } = await supabase
      .from("carreras")
      .select("id")
      .eq("id", idCarrera)
      .maybeSingle();

    if (!carreraExiste) {
      console.warn(`Error: La carrera con ID ${idCarrera} no existe`);
      return null;
    }

    const data: Record<string, any> = {
      nombre,
      correo,
      carrera_id: idCarrera,
    };

    if (id == null) {
      data.estado = "pendiente";
      data.folio = folio ?? generarFolioUnico();
    }

    // 2. Insertar o actualizar en la BD
    const query =
      id == null
        ? supabase.from("aspirantes").insert(data).select().maybeSingle()
        : supabase
            .from("aspirantes")
            .update(data)
            .eq("id", id)
            .select()
            .maybeSingle();

    const { data: respuesta, error } = await query;

    if (error || !respuesta) {
      console.warn("Error: No se pudo registrar el aspirante", error);
      return null;
    }

    return respuesta;
  } catch (e) {
    console.warn("Error en registrarAspirante:", e);
    return null;
  }
}

/** Inserta un registro directo en la tabla 'aspirantes'. */
export async function crearAspirante(
  data: Record<string, any>,
): Promise<Record<string, any> | null> {
  try {
    const { data: res, error } = await supabase
      .from("aspirantes")
      .insert(data)
      .select()
      .maybeSingle();
    if (error || !res) return null;
    return res;
  } catch (e) {
    console.warn("Error en crearAspirante:", e);
    return null;
  }
}

/** Obtiene todos los aspirantes registrados. */
export async function obtenerAspirantes(): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from("aspirantes")
      .select("*, carreras(nombre)")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("Error en obtenerAspirantes:", e);
    return [];
  }
}

/**
 * Elimina un aspirante y sus respuestas asociadas.
 *
 * Antes llamaba a la función RPC `eliminar_aspirante_y_respuestas`, pero esa
 * función no existe en la base de datos (por eso la petición se quedaba
 * "cargando" para siempre, sin error ni respuesta). Como las políticas RLS
 * de `respuestas` y `aspirantes` ya permiten borrar directo, hacemos el
 * borrado aquí mismo, en el mismo orden (respuestas primero, por la FK).
 */
export async function eliminarAspirante(id: number): Promise<boolean> {
  try {
    // 1. Borrar las respuestas del aspirante primero (respetar FK).
    const { error: errorRespuestas } = await supabase
      .from("respuestas")
      .delete()
      .eq("aspirante_id", id);
    if (errorRespuestas) throw errorRespuestas;

    // 2. Borrar el aspirante. Se pide `select('id')` para confirmar que la
    // fila realmente se eliminó (si RLS bloqueara, Supabase no manda error
    // pero tampoco devuelve la fila borrada).
    const { data, error: errorAspirante } = await supabase
      .from("aspirantes")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (errorAspirante) throw errorAspirante;

    if (!data) {
      console.warn(
        "eliminarAspirante: 0 filas afectadas (posible bloqueo de RLS).",
      );
      return false;
    }

    return true;
  } catch (e) {
    console.warn("Error en eliminarAspirante:", e);
    return false;
  }
}

interface ValidarFolioParams {
  folio: string;
  correo: string;
}

/**
 * Valida las credenciales de acceso de un aspirante (folio y correo).
 * Usa ilike para ignorar mayúsculas/minúsculas y trim para eliminar espacios accidentales.
 */
export async function validarFolio({
  folio,
  correo,
}: ValidarFolioParams): Promise<Record<string, any> | null> {
  try {
    const folioLimpio = folio.trim();
    const correoLimpio = correo.trim();

    const { data: aspirante, error } = await supabase
      .from("aspirantes")
      .select("*, carreras(nombre)")
      .ilike("folio", folioLimpio)
      .ilike("correo", correoLimpio)
      .maybeSingle();

    if (error || !aspirante) return null;

    const resultado = { ...aspirante };

    // Extraer carrera_nombre del join incluido en la misma consulta
    const carrerasJoin = resultado.carreras;
    if (resultado.carrera_nombre == null) {
      if (Array.isArray(carrerasJoin)) {
        resultado.carrera_nombre = carrerasJoin[0]?.nombre ?? "Desconocida";
      } else if (carrerasJoin && typeof carrerasJoin === "object") {
        resultado.carrera_nombre = carrerasJoin.nombre ?? "Desconocida";
      } else {
        resultado.carrera_nombre = "Desconocida";
      }
    }

    return resultado;
  } catch (e) {
    console.warn("Error en validarFolio:", e);
    return null;
  }
}

interface RegistrarAsistenciaQRParams {
  folio: string;
  correo: string;
  sede: string;
}

/**
 * Registra la asistencia de un aspirante escaneado por QR el día del examen.
 * Evita duplicados: si ya se registró hoy, no vuelve a insertar.
 */
export async function registrarAsistenciaQR({
  folio,
  correo,
  sede,
}: RegistrarAsistenciaQRParams): Promise<Record<string, any> | null> {
  try {
    const folioLimpio = folio.trim();
    const correoLimpio = correo.trim();

    console.log("[QR] registrarAsistenciaQR buscando aspirante", {
      folio: folioLimpio,
      correo: correoLimpio,
    });

    const { data: aspirante, error: aspiranteError } = await supabase
      .from("aspirantes")
      .select("id,nombre,correo,carrera_id")
      .ilike("folio", folioLimpio)
      .ilike("correo", correoLimpio)
      .maybeSingle();

    if (aspiranteError) {
      console.warn(
        "Error en registrarAsistenciaQR (buscar aspirante):",
        aspiranteError,
      );
      return null;
    }

    let aspiranteEncontrado = aspirante;

    if (!aspiranteEncontrado) {
      console.warn(
        "registrarAsistenciaQR: aspirante no encontrado con coincidencia exacta ilike",
        { folio: folioLimpio, correo: correoLimpio },
      );

      const { data: aspiranteFallback, error: aspiranteFallbackError } =
        await supabase
          .from("aspirantes")
          .select("id,nombre,correo,carrera_id")
          .ilike("folio", `%${folioLimpio}%`)
          .ilike("correo", `%${correoLimpio}%`)
          .maybeSingle();

      if (aspiranteFallbackError) {
        console.warn(
          "Error en registrarAsistenciaQR (buscar aspirante fallback):",
          aspiranteFallbackError,
        );
        return null;
      }

      aspiranteEncontrado = aspiranteFallback;
      if (aspiranteEncontrado) {
        console.log(
          "registrarAsistenciaQR: aspirante encontrado con fallback",
          {
            folio: folioLimpio,
            correo: aspiranteEncontrado.correo,
          },
        );
      }
    }

    if (!aspiranteEncontrado) return null;

    // Evitar duplicados: comprobar la última asistencia registrada
    const { data: ultAsistenciaRes, error: ultAsistenciaError } = await supabase
      .from("asistencias")
      .select("id,registrado_en,sede")
      .eq("aspirante_id", aspiranteEncontrado.id)
      .order("registrado_en", { ascending: false })
      .limit(1);

    if (ultAsistenciaError) {
      console.warn(
        "Error en registrarAsistenciaQR (última asistencia):",
        ultAsistenciaError,
      );
      return null;
    }

    let yaRegistradaHoy = false;
    const ultima = ultAsistenciaRes?.[0];
    if (ultima?.registrado_en) {
      const registradoEn = new Date(ultima.registrado_en);
      const ahora = new Date();
      if (
        registradoEn.getFullYear() === ahora.getFullYear() &&
        registradoEn.getMonth() === ahora.getMonth() &&
        registradoEn.getDate() === ahora.getDate()
      ) {
        yaRegistradaHoy = true;
      }
    }

    if (!yaRegistradaHoy) {
      const { data: respuesta, error: insertarError } = await supabase
        .from("asistencias")
        .insert({
          aspirante_id: aspiranteEncontrado.id,
          folio: folioLimpio,
          correo: correoLimpio,
          carrera_id: aspiranteEncontrado.carrera_id,
          sede,
          registrado_en: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (insertarError) {
        console.warn(
          "Error en registrarAsistenciaQR (insertar asistencia):",
          insertarError,
        );
        return null;
      }

      if (!respuesta) {
        console.warn(
          "Error en registrarAsistenciaQR: inserción de asistencia no devolvió fila",
          {
            aspiranteId: aspiranteEncontrado.id,
            folio: folioLimpio,
            correo: correoLimpio,
          },
        );
        return null;
      }

      // Marcar al aspirante como asistido
      const { error: actualizarError } = await supabase
        .from("aspirantes")
        .update({ asistencia: true })
        .eq("id", aspiranteEncontrado.id);

      if (actualizarError) {
        console.warn(
          "Error en registrarAsistenciaQR (actualizar aspirante):",
          actualizarError,
        );
      }
    }

    // Devolver el aspirante actualizado (con asistencia true si aplica)
    const { data: aspiranteActualizado } = await supabase
      .from("aspirantes")
      .select("id,nombre,correo,carrera_id,asistencia")
      .eq("id", aspiranteEncontrado.id)
      .maybeSingle();

    const base: Record<string, any> = aspiranteActualizado ?? aspiranteEncontrado;

    // Incluir metadatos para que el cliente sepa si la marca fue creada ahora
    base.registradoAhora = !yaRegistradaHoy;
    base.ultima_registrado_en = ultima?.registrado_en ?? null;

    return base;
  } catch (e) {
    console.warn("Error en registrarAsistenciaQR:", e);
    return null;
  }
}

/** Obtiene un aspirante por su id, con el nombre de su carrera incluido. */
export async function obtenerAspirantePorId(
  id: number,
): Promise<Record<string, any> | null> {
  try {
    const { data: res, error } = await supabase
      .from("aspirantes")
      .select("*, carreras(nombre)")
      .eq("id", id)
      .maybeSingle();
    if (error || !res) return null;

    const resultado = { ...res };
    const carrerasJoin = resultado.carreras;
    if (
      resultado.carrera_nombre == null &&
      carrerasJoin &&
      typeof carrerasJoin === "object"
    ) {
      resultado.carrera_nombre = carrerasJoin.nombre ?? "Desconocida";
    }
    return resultado;
  } catch (e) {
    console.warn("Error en obtenerAspirantePorId:", e);
    return null;
  }
}

/** Obtiene todos los aspirantes registrados en una carrera, ordenados por nombre. */
export async function obtenerAspirantesPorCarrera(
  carreraId: number,
): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from("aspirantes")
      .select(
        "id, folio, nombre, correo, estado, asistencia, resultado, aciertos, examen_finalizado",
      )
      .eq("carrera_id", carreraId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    console.warn("Error en obtenerAspirantesPorCarrera:", e);
    return [];
  }
}

/** Actualiza la asistencia manual de un aspirante (campo booleano). */
export async function actualizarAsistencia(
  idAspirante: number,
  asistio: boolean,
): Promise<boolean> {
  try {
    const { data: res, error } = await supabase
      .from("aspirantes")
      .update({ asistencia: asistio })
      .eq("id", idAspirante)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return res != null;
  } catch (e) {
    console.warn("Error en actualizarAsistencia:", e);
    return false;
  }
}

/**
 * EXCEPCIÓN: reactiva a un aspirante que ya presentó su examen para que
 * pueda volver a hacerlo desde cero. Borra sus respuestas del intento
 * anterior y reinicia su estado a 'pendiente'.
 *
 * ⚠️ Esto es IRREVERSIBLE: se pierden las respuestas y el resultado anterior.
 */
export async function reactivarExamenAspirante(
  idAspirante: number,
): Promise<boolean> {
  try {
    // 1. Borrar las respuestas del intento anterior.
    const { error: errorRespuestas } = await supabase
      .from("respuestas")
      .delete()
      .eq("aspirante_id", idAspirante);
    if (errorRespuestas) throw errorRespuestas;

    // 2. Reiniciar el estado del aspirante para un nuevo intento.
    // Se pide `select('id')` para confirmar que la fila realmente se
    // actualizó: si RLS bloquea el update, Supabase no manda error, pero
    // tampoco devuelve la fila afectada.
    const { data, error: errorUpdate } = await supabase
      .from("aspirantes")
      .update({
        examen_finalizado: false,
        estado: "pendiente",
        resultado: null,
        aciertos: null,
        hora_inicio: null,
        hora_fin: null,
      })
      .eq("id", idAspirante)
      .select("id")
      .maybeSingle();
    if (errorUpdate) throw errorUpdate;

    if (!data) {
      console.warn(
        "reactivarExamenAspirante: 0 filas afectadas (posible bloqueo de RLS).",
      );
      return false;
    }

    return true;
  } catch (e) {
    console.warn("Error en reactivarExamenAspirante:", e);
    return false;
  }
}

/**
 * Obtiene las asistencias más recientes (con nombre del aspirante) para
 * mostrar en la campanita de notificaciones del panel de administración.
 */
export async function obtenerAsistenciasRecientes(
  limite: number = 20,
): Promise<Record<string, any>[]> {
  try {
    const { data, error } = await supabase
      .from("asistencias")
      .select("id,folio,correo,sede,registrado_en,aspirante_id,aspirantes(nombre)")
      .order("registrado_en", { ascending: false })
      .limit(limite);

    if (error) {
      console.warn("Error en obtenerAsistenciasRecientes:", error);
      return [];
    }

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      folio: fila.folio,
      correo: fila.correo,
      sede: fila.sede,
      registrado_en: fila.registrado_en,
      aspirante_id: fila.aspirante_id,
      nombre: fila.aspirantes?.nombre ?? fila.correo,
    }));
  } catch (e) {
    console.warn("Error en obtenerAsistenciasRecientes:", e);
    return [];
  }
}

/** Marca la hora de inicio del examen, solo si aún no se había registrado. */
export async function registrarInicioExamen(
  idAspirante: number,
): Promise<void> {
  try {
    const { data: actual } = await supabase
      .from("aspirantes")
      .select("hora_inicio")
      .eq("id", idAspirante)
      .maybeSingle();

    if (actual && actual.hora_inicio == null) {
      await supabase
        .from("aspirantes")
        .update({ hora_inicio: new Date().toISOString() })
        .eq("id", idAspirante);
    }
  } catch (e) {
    console.warn("Error en registrarInicioExamen:", e);
  }
}