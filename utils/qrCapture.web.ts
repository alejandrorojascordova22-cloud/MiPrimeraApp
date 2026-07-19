import { View } from "react-native";

// En web no usamos view-shot/media-library (no son compatibles).
// Exportamos View como reemplazo simple del contenedor.
export const ViewShot = View;

export async function capturarYGuardarQR(
  _viewShotRef: React.RefObject<any>,
  folio: string,
): Promise<{ ok: boolean; mensaje: string }> {
  // Nota: no capturamos automáticamente el QR como imagen en web.
  // Si más adelante quieres soportarlo, se puede usar una librería
  // compatible con web como 'html-to-image' o 'dom-to-image'.
  return {
    ok: false,
    mensaje:
      "La descarga automática del QR aún no está disponible en la versión web. Puedes tomar una captura de pantalla.",
  };
}
