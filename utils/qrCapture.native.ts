import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import ViewShot from "react-native-view-shot";

export { ViewShot };

export async function capturarYGuardarQR(
  viewShotRef: React.RefObject<any>,
  _folio: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const uri = await captureRef(viewShotRef, {
    format: "png",
    quality: 1,
  });

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    return {
      ok: false,
      mensaje: "No se puede guardar la imagen sin permisos.",
    };
  }

  await MediaLibrary.saveToLibraryAsync(uri);
  return { ok: true, mensaje: "El código QR se ha guardado en tu galería." };
}
