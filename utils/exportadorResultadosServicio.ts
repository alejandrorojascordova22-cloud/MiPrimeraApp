/**
 * Exportador de resultados a Excel (.xlsx) y PDF con marca de agua.
 *
 * Sustituye a la exportación anterior (solo CSV vía Share nativo). Ahora
 * se generan archivos reales de Excel y PDF, ambos con una marca de agua /
 * leyenda institucional ("Documento institucional... requiere autorización
 * para su modificación"), y se le da al usuario la opción de:
 *  - Visualizar / compartir el archivo (hoja de compartir del sistema)
 *  - Descargarlo directamente (en web, descarga el archivo sin comprimir)
 *
 * Excel: se arma con "exceljs". Se cambió de "xlsx" (SheetJS) a "exceljs"
 * porque la versión gratuita de "xlsx" NO escribe estilos (colores,
 * bordes, negritas) de forma confiable — al abrir el archivo, Excel
 * mostraba colores aleatorios o de plano ignoraba el estilo. "exceljs" sí
 * soporta esto correctamente.
 * PDF: se arma como HTML (con la marca de agua repetida en diagonal sobre
 * el contenido) y se convierte a PDF con "expo-print" en nativo; en web se
 * abre una ventana de impresión del navegador para guardar como PDF.
 */

import ExcelJS from "exceljs";
import { Platform } from "react-native";

export type FilaExportable = {
  numero: number;
  folio: string;
  nombre: string;
  carrera: string;
  correo: string;
  asistencia: string;
  calificacion: string;
  aciertos: number | string;
  estado: string;
};

const LEYENDA_INSTITUCIONAL =
  "Este es un documento institucional confidencial. Su modificación no está permitida sin autorización previa.";

const ENCABEZADOS = [
  "#",
  "FOLIO",
  "NOMBRE",
  "CARRERA",
  "CORREO",
  "ASISTENCIA",
  "CALIFICACIÓN",
  "ACIERTOS",
  "ESTADO",
];

const filaAArray = (f: FilaExportable) => [
  f.numero,
  f.folio,
  f.nombre,
  f.carrera,
  f.correo,
  f.asistencia,
  f.calificacion,
  f.aciertos,
  f.estado,
];

const nombreArchivoSeguro = (base: string) =>
  base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_");

/** Calcula estadísticas rápidas (presentes, aprobados, promedio) para el
 * resumen que se agrega arriba de la tabla, tanto en Excel como en PDF. */
function calcularEstadisticas(filas: FilaExportable[]) {
  const total = filas.length;
  const presentes = filas.filter((f) => f.asistencia === "Presente").length;
  const calificacionesNumericas = filas
    .map((f) => parseFloat(String(f.calificacion).replace("%", "")))
    .filter((n) => !Number.isNaN(n));
  const aprobados = calificacionesNumericas.filter((n) => n >= 60).length;
  const promedio =
    calificacionesNumericas.length > 0
      ? calificacionesNumericas.reduce((a, b) => a + b, 0) /
        calificacionesNumericas.length
      : 0;
  return {
    total,
    presentes,
    ausentes: total - presentes,
    aprobados,
    reprobados: calificacionesNumericas.length - aprobados,
    promedio: Math.round(promedio * 10) / 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// EXCEL (.xlsx)
// ─────────────────────────────────────────────────────────────────────────

const COLOR_MORADO = "FF4C1D95";
const COLOR_MORADO_CLARO = "FFF5F3FF";
const COLOR_FILA_ALTERNA = "FFF7F5FF";
const COLOR_VERDE = "FFDCFCE7";
const COLOR_VERDE_TEXTO = "FF15803D";
const COLOR_ROJO = "FFFEE2E2";
const COLOR_ROJO_TEXTO = "FFB91C1C";
const COLOR_BORDE = "FFE5E7EB";

async function construirLibroExcel(filas: FilaExportable[], titulo: string) {
  const stats = calcularEstadisticas(filas);

  const libro = new ExcelJS.Workbook();
  libro.creator = "Sistema de Admisiones - UT de Oriental";
  libro.created = new Date();
  const hoja = libro.addWorksheet("Resultados", {
    views: [{ state: "frozen", ySplit: 5 }], // encabezados siempre visibles al hacer scroll
  });

  hoja.columns = [
    { width: 5 },
    { width: 18 },
    { width: 26 },
    { width: 30 },
    { width: 30 },
    { width: 12 },
    { width: 13 },
    { width: 10 },
    { width: 14 },
  ];

  const numCols = ENCABEZADOS.length;
  const bordeFino = {
    top: { style: "thin" as const, color: { argb: COLOR_BORDE } },
    bottom: { style: "thin" as const, color: { argb: COLOR_BORDE } },
    left: { style: "thin" as const, color: { argb: COLOR_BORDE } },
    right: { style: "thin" as const, color: { argb: COLOR_BORDE } },
  };

  // Fila 1: título
  hoja.mergeCells(1, 1, 1, numCols);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = `Resultados - ${titulo}`;
  celdaTitulo.font = { bold: true, size: 14, color: { argb: COLOR_MORADO } };
  hoja.getRow(1).height = 24;

  // Fila 2: leyenda institucional
  hoja.mergeCells(2, 1, 2, numCols);
  const celdaLeyenda = hoja.getCell(2, 1);
  celdaLeyenda.value = LEYENDA_INSTITUCIONAL;
  celdaLeyenda.font = { italic: true, size: 9, color: { argb: "FF6B21A8" } };

  // Fila 3: resumen de estadísticas
  const filaResumen = hoja.getRow(3);
  const textosResumen = [
    `Total: ${stats.total}`,
    `Presentes: ${stats.presentes}`,
    `Ausentes: ${stats.ausentes}`,
    `Aprobados: ${stats.aprobados}`,
    `Reprobados: ${stats.reprobados}`,
    `Promedio: ${stats.promedio}%`,
  ];
  textosResumen.forEach((texto, i) => {
    const celda = filaResumen.getCell(i + 1);
    celda.value = texto;
    celda.font = { bold: true, size: 10, color: { argb: COLOR_MORADO } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_MORADO_CLARO },
    };
  });
  filaResumen.height = 18;

  // Fila 5: encabezados de columna
  const filaEncabezados = hoja.getRow(5);
  ENCABEZADOS.forEach((texto, i) => {
    const celda = filaEncabezados.getCell(i + 1);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_MORADO },
    };
    celda.alignment = { horizontal: "center", vertical: "middle" };
    celda.border = bordeFino;
  });
  filaEncabezados.height = 20;

  // Filtro desplegable en la fila de encabezados.
  hoja.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: numCols },
  };

  // Filas de datos
  filas.forEach((f, i) => {
    const fila = hoja.getRow(6 + i);
    const valores = filaAArray(f);
    valores.forEach((valor, c) => {
      const celda = fila.getCell(c + 1);
      celda.value = valor;
      celda.border = bordeFino;
      if (i % 2 === 1) {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_FILA_ALTERNA },
        };
      }
      if ([0, 5, 6, 7].includes(c)) {
        celda.alignment = { horizontal: "center" };
      }
    });

    // Columna CALIFICACIÓN (índice 6): negrita + color según aprobado/reprobado
    const celdaCalificacion = fila.getCell(7);
    const numCalificacion = parseFloat(
      String(f.calificacion).replace("%", ""),
    );
    const aprobado = !Number.isNaN(numCalificacion) && numCalificacion >= 60;
    celdaCalificacion.font = {
      bold: true,
      color: { argb: aprobado ? COLOR_VERDE_TEXTO : COLOR_ROJO_TEXTO },
    };
    celdaCalificacion.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: aprobado ? COLOR_VERDE : COLOR_ROJO },
    };

    // Columna ASISTENCIA (índice 5): color según presente/ausente
    const celdaAsistencia = fila.getCell(6);
    const presente = f.asistencia === "Presente";
    celdaAsistencia.font = {
      color: { argb: presente ? COLOR_VERDE_TEXTO : "FF6B7280" },
    };
  });

  return libro;
}

/** Convierte un ArrayBuffer a base64 en bloques, para no reventar el
 * stack con archivos grandes (btoa de una sola llamada falla con
 * strings muy largos en algunos navegadores). */
function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const tamanoBloque = 0x8000;
  let binario = "";
  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    const bloque = bytes.subarray(i, i + tamanoBloque);
    binario += String.fromCharCode.apply(null, Array.from(bloque));
  }
  return btoa(binario);
}

async function guardarYCompartirArchivo(
  base64: string,
  nombreArchivo: string,
  mimeType: string,
  accion: "compartir" | "descargar",
) {
  if (Platform.OS === "web") {
    // Blob + URL.createObjectURL es más confiable en navegadores que una
    // data-URI (que puede fallar con archivos grandes). Convertimos el
    // base64 a bytes manualmente.
    try {
      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error("Error al descargar el archivo en web:", err);
      throw err;
    }
    return;
  }

  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");
  const uri = `${FileSystem.cacheDirectory}${nombreArchivo}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (accion === "descargar" && Platform.OS === "android") {
    // Intenta guardar directamente en el almacenamiento del dispositivo.
    try {
      const permisos =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permisos.granted) {
        const destino =
          await FileSystem.StorageAccessFramework.createFileAsync(
            permisos.directoryUri,
            nombreArchivo,
            mimeType,
          );
        await FileSystem.writeAsStringAsync(destino, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return;
      }
    } catch {
      // Si el usuario cancela el selector de carpeta, se cae al compartir.
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle:
        accion === "descargar"
          ? `Guardar ${nombreArchivo}`
          : `Compartir ${nombreArchivo}`,
      UTI:
        mimeType === "application/pdf"
          ? "com.adobe.pdf"
          : "org.openxmlformats.spreadsheetml.sheet",
    });
  }
}

export async function exportarResultadosExcel(
  filas: FilaExportable[],
  titulo: string,
  accion: "compartir" | "descargar" = "compartir",
) {
  const libro = await construirLibroExcel(filas, titulo);
  const buffer = await libro.xlsx.writeBuffer();
  const base64 = arrayBufferABase64(buffer as ArrayBuffer);
  const nombreArchivo = `Resultados_${nombreArchivoSeguro(titulo)}.xlsx`;
  await guardarYCompartirArchivo(
    base64,
    nombreArchivo,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    accion,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PDF con marca de agua
// ─────────────────────────────────────────────────────────────────────────

function construirHtmlPdf(filas: FilaExportable[], titulo: string) {
  const stats = calcularEstadisticas(filas);

  const badgeAsistencia = (valor: string) =>
    valor === "Presente"
      ? `<span class="badge badge-ok">${valor}</span>`
      : `<span class="badge badge-neutro">${valor}</span>`;

  const badgeEstado = (valor: string) => {
    const v = (valor ?? "").toLowerCase();
    const clase =
      v === "terminado" ? "badge-ok" : v === "pendiente" ? "badge-warn" : "badge-neutro";
    return `<span class="badge ${clase}">${valor}</span>`;
  };

  const badgeCalificacion = (valor: string) => {
    const n = parseFloat(String(valor).replace("%", ""));
    const clase = n >= 60 ? "badge-ok" : "badge-mal";
    return `<span class="badge ${clase}">${valor}</span>`;
  };

  const filasHtml = filas
    .map(
      (f, i) => `
      <tr class="${i % 2 === 1 ? "fila-alterna" : ""}">
        <td class="centro">${f.numero}</td>
        <td class="mono">${f.folio}</td>
        <td>${f.nombre}</td>
        <td>${f.carrera}</td>
        <td>${f.correo}</td>
        <td class="centro">${badgeAsistencia(f.asistencia)}</td>
        <td class="centro">${badgeCalificacion(f.calificacion)}</td>
        <td class="centro">${f.aciertos}</td>
        <td class="centro">${badgeEstado(f.estado)}</td>
      </tr>`,
    )
    .join("");

  // Marca de agua: el texto institucional repetido en diagonal, detrás
  // del contenido, en toda la página (patrón de fondo).
  return `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: Helvetica, Arial, sans-serif;
        margin: 0;
        padding: 28px;
        color: #1a1a2e;
        position: relative;
      }
      .marca-agua {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -1;
        overflow: hidden;
        display: flex;
        flex-wrap: wrap;
        align-content: space-between;
        justify-content: space-between;
        opacity: 0.08;
        pointer-events: none;
      }
      .marca-agua span {
        display: inline-block;
        width: 33%;
        transform: rotate(-30deg);
        font-size: 11px;
        font-weight: bold;
        text-align: center;
        color: #6d28d9;
        margin: 28px 0;
      }
      .encabezado {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 3px solid #4c1d95;
        padding-bottom: 10px;
        margin-bottom: 12px;
      }
      h1 { font-size: 19px; margin: 0 0 3px 0; color: #4c1d95; }
      .subtitulo { font-size: 10px; color: #6b7280; }
      .fecha-generado { font-size: 9px; color: #9ca3af; text-align: right; }
      .leyenda {
        font-size: 9.5px;
        color: #6b21a8;
        border: 1px solid #a78bfa;
        background: #f5f3ff;
        padding: 6px 10px;
        border-radius: 5px;
        margin-bottom: 16px;
      }
      .tarjetas {
        display: flex;
        gap: 8px;
        margin-bottom: 18px;
      }
      .tarjeta {
        flex: 1;
        border-radius: 8px;
        padding: 10px 8px;
        text-align: center;
        border: 1px solid #e5e7eb;
        background: #fafafa;
      }
      .tarjeta .valor { font-size: 18px; font-weight: bold; color: #1a1a2e; }
      .tarjeta .etiqueta { font-size: 8.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }
      .tarjeta.morada { background: #f5f3ff; border-color: #ddd6fe; }
      .tarjeta.morada .valor { color: #6d28d9; }
      .tarjeta.verde { background: #f0fdf4; border-color: #bbf7d0; }
      .tarjeta.verde .valor { color: #15803d; }
      .tarjeta.gris { background: #f9fafb; }
      table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 7px; text-align: left; }
      th { background: #4c1d95; color: white; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
      .fila-alterna { background: #f7f5ff; }
      .centro { text-align: center; }
      .mono { font-family: 'Courier New', monospace; font-size: 9px; }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 8.5px;
        font-weight: bold;
      }
      .badge-ok { background: #dcfce7; color: #15803d; }
      .badge-mal { background: #fee2e2; color: #b91c1c; }
      .badge-warn { background: #fef3c7; color: #92400e; }
      .badge-neutro { background: #f3f4f6; color: #4b5563; }
      .pie { margin-top: 16px; font-size: 8.5px; color: #9ca3af; text-align: center; }
    </style>
  </head>
  <body>
    <div class="marca-agua">
      ${Array.from({ length: 24 })
        .map(() => `<span>${LEYENDA_INSTITUCIONAL}</span>`)
        .join("")}
    </div>

    <div class="encabezado">
      <div>
        <h1>Resultados - ${titulo}</h1>
        <div class="subtitulo">Universidad Tecnológica de Oriental · Examen de Admisión 2026</div>
      </div>
      <div class="fecha-generado">Generado el<br/>${new Date().toLocaleString("es-MX")}</div>
    </div>

    <div class="leyenda">${LEYENDA_INSTITUCIONAL}</div>

    <div class="tarjetas">
      <div class="tarjeta gris"><div class="valor">${stats.total}</div><div class="etiqueta">Total</div></div>
      <div class="tarjeta gris"><div class="valor">${stats.presentes}</div><div class="etiqueta">Presentes</div></div>
      <div class="tarjeta gris"><div class="valor">${stats.ausentes}</div><div class="etiqueta">Ausentes</div></div>
      <div class="tarjeta verde"><div class="valor">${stats.aprobados}</div><div class="etiqueta">Aprobados</div></div>
      <div class="tarjeta gris"><div class="valor">${stats.reprobados}</div><div class="etiqueta">Reprobados</div></div>
      <div class="tarjeta morada"><div class="valor">${stats.promedio}%</div><div class="etiqueta">Promedio</div></div>
    </div>

    <table>
      <thead><tr>${ENCABEZADOS.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <div class="pie">Documento generado automáticamente por el sistema de admisiones · UT de Oriental</div>
  </body>
  </html>`;
}

export async function exportarResultadosPDF(
  filas: FilaExportable[],
  titulo: string,
  accion: "compartir" | "descargar" = "compartir",
) {
  const html = construirHtmlPdf(filas, titulo);
  const nombreArchivo = `Resultados_${nombreArchivoSeguro(titulo)}.pdf`;

  if (Platform.OS === "web") {
    // No hay generador de PDF nativo en web: se abre una ventana con el
    // documento formateado y se dispara el diálogo de impresión, desde
    // donde el navegador permite "Guardar como PDF" (descarga real y sin
    // comprimir, o vista previa antes de guardar).
    const ventana = window.open("", "_blank");
    if (ventana) {
      ventana.document.write(html);
      ventana.document.close();
      ventana.focus();
      setTimeout(() => ventana.print(), 300);
    }
    return;
  }

  const Print = await import("expo-print");
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  if (accion === "compartir") {
    const Sharing = await import("expo-sharing");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Compartir ${nombreArchivo}`,
        UTI: "com.adobe.pdf",
      });
      return;
    }
  }

  // "descargar" o compartir no disponible: mover el PDF generado a un
  // nombre legible en caché y compartir/guardar desde ahí.
  const FileSystem = await import("expo-file-system/legacy");
  const destino = `${FileSystem.cacheDirectory}${nombreArchivo}`;
  await FileSystem.copyAsync({ from: uri, to: destino });
  const Sharing = await import("expo-sharing");
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino, {
      mimeType: "application/pdf",
      dialogTitle: `Guardar ${nombreArchivo}`,
      UTI: "com.adobe.pdf",
    });
  }
}