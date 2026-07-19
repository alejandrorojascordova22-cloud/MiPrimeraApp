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
 * Excel: se arma con la librería "xlsx" (SheetJS), sin dependencias nativas.
 * PDF: se arma como HTML (con la marca de agua repetida en diagonal sobre
 * el contenido) y se convierte a PDF con "expo-print" en nativo; en web se
 * abre una ventana de impresión del navegador para guardar como PDF.
 */

import * as XLSX from "xlsx";
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

// ─────────────────────────────────────────────────────────────────────────
// EXCEL (.xlsx)
// ─────────────────────────────────────────────────────────────────────────

function construirLibroExcel(filas: FilaExportable[], titulo: string) {
  const aoa: any[][] = [
    [`Resultados - ${titulo}`],
    [LEYENDA_INSTITUCIONAL],
    [],
    ENCABEZADOS,
    ...filas.map(filaAArray),
  ];

  const hoja = XLSX.utils.aoa_to_sheet(aoa);

  // Combinar celdas del título y la leyenda para que se vean como encabezado.
  hoja["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ENCABEZADOS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: ENCABEZADOS.length - 1 } },
  ];
  hoja["!cols"] = [
    { wch: 4 },
    { wch: 16 },
    { wch: 26 },
    { wch: 26 },
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Resultados");
  return libro;
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
  const libro = construirLibroExcel(filas, titulo);
  const base64 = XLSX.write(libro, { type: "base64", bookType: "xlsx" });
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
  const filasHtml = filas
    .map(
      (f) => `
      <tr>
        <td>${f.numero}</td>
        <td>${f.folio}</td>
        <td>${f.nombre}</td>
        <td>${f.carrera}</td>
        <td>${f.correo}</td>
        <td>${f.asistencia}</td>
        <td>${f.calificacion}</td>
        <td>${f.aciertos}</td>
        <td>${f.estado}</td>
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
        padding: 24px;
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
        opacity: 0.10;
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
      h1 { font-size: 18px; margin-bottom: 2px; color: #4c1d95; }
      .leyenda {
        font-size: 10px;
        color: #6b21a8;
        border: 1px solid #a78bfa;
        background: #f5f3ff;
        padding: 6px 10px;
        border-radius: 4px;
        margin-bottom: 14px;
      }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
      th { background: #4c1d95; color: white; }
      tr:nth-child(even) { background: #f7f5ff; }
      .pie { margin-top: 16px; font-size: 9px; color: #888; }
    </style>
  </head>
  <body>
    <div class="marca-agua">
      ${Array.from({ length: 24 })
        .map(() => `<span>${LEYENDA_INSTITUCIONAL}</span>`)
        .join("")}
    </div>
    <h1>Resultados - ${titulo}</h1>
    <div class="leyenda">${LEYENDA_INSTITUCIONAL}</div>
    <table>
      <thead><tr>${ENCABEZADOS.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>
    <div class="pie">Generado el ${new Date().toLocaleString("es-MX")}</div>
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